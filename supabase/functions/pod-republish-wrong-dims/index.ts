// Repairs Printify products whose artwork doesn't match the canonical PRINT_SPECS.
// Flow per listing:
//   1) regenerate artwork via Lovable AI image model (buildPrintPrompt)
//   2) normalizeToSpec → guarantees exact pixel dims + correct bgMode
//   3) validateImageDimensions (hard gate)
//   4) upload to Printify
//   5) PUT product with corrected print_areas
//   6) unpublish + re-publish so Etsy gets the new artwork in the mockup set
//
// Body: { listing_ids?: string[]; statuses?: string[]; limit?: number; dry_run?: boolean }
// Defaults: pulls listings whose LATEST pod_dimension_audit row is in
//   ['wrong_dims','wrong_aspect','missing'].
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { POD_CATALOG } from "../_shared/pod-printify-catalog.ts";
import { getPrintSpec, validateImageDimensions, placeholderPlacement, buildPrintPrompt, normalizeToSpec } from "../_shared/pod-print-spec.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PRINTIFY_TOKEN = Deno.env.get("PRINTIFY_API_TOKEN")!;
const PRINTIFY_SHOP_ID = Deno.env.get("PRINTIFY_SHOP_ID") || "2890106";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

const sb = createClient(SUPABASE_URL, SERVICE_ROLE);

async function pf(path: string, init?: RequestInit) {
  const res = await fetch(`https://api.printify.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${PRINTIFY_TOKEN}`,
      "User-Agent": "Lovable-POD/1.0",
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`pf_${res.status}: ${text.slice(0, 250)}`);
  return text ? JSON.parse(text) : null;
}

async function generateImage(prompt: string): Promise<string> {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${LOVABLE_API_KEY}` },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-image",
      modalities: ["image", "text"],
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`image_gen_${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const url: string | undefined = data?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (!url?.startsWith("data:image/")) throw new Error("image_gen_no_data");
  return url.slice(url.indexOf(",") + 1);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const body = await req.json().catch(() => ({}));
  const { listing_ids, statuses, limit = 25, dry_run = false } = body as {
    listing_ids?: string[]; statuses?: string[]; limit?: number; dry_run?: boolean;
  };

  // Resolve target listings.
  let targets: { id: string; printify_id: string; product_type: string; product_name: string; image_prompt: string | null }[] = [];
  if (listing_ids?.length) {
    const { data } = await sb.from("pod_listings")
      .select("id, printify_id, product_type, product_name, image_prompt")
      .in("id", listing_ids);
    targets = data ?? [];
  } else {
    const wantedStatuses = statuses?.length ? statuses : ["wrong_dims", "wrong_aspect", "missing"];
    // Latest audit per listing
    const { data: audits } = await sb.from("pod_dimension_audit")
      .select("listing_id, status, audited_at")
      .order("audited_at", { ascending: false })
      .limit(2000);
    const latest = new Map<string, string>();
    for (const a of audits ?? []) {
      if (!latest.has(a.listing_id)) latest.set(a.listing_id, a.status);
    }
    const ids = [...latest.entries()].filter(([_, s]) => wantedStatuses.includes(s)).map(([id]) => id);
    if (!ids.length) {
      return new Response(JSON.stringify({ ok: true, repaired: 0, message: "no broken listings" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { data } = await sb.from("pod_listings")
      .select("id, printify_id, product_type, product_name, image_prompt")
      .in("id", ids.slice(0, limit));
    targets = data ?? [];
  }

  if (dry_run) {
    return new Response(JSON.stringify({ would_repair: targets.length, targets }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const results: any[] = [];
  for (const t of targets) {
    const spec = getPrintSpec(t.product_type);
    const entry = POD_CATALOG[t.product_type];
    if (!spec || !entry) {
      results.push({ id: t.id, ok: false, error: `no_spec_or_catalog_${t.product_type}` });
      continue;
    }
    try {
      const prompt = buildPrintPrompt(t.image_prompt || `${t.product_name} design`, t.product_type);
      const raw = await generateImage(prompt);
      const fixed = await normalizeToSpec(raw, spec);
      const v = await validateImageDimensions(fixed, spec);
      if (!v.ok) throw new Error(`post_norm_fail_${v.reason}`);

      const upload: any = await pf(`/uploads/images.json`, {
        method: "POST",
        body: JSON.stringify({ file_name: `${t.product_type}-fix-${Date.now()}.png`, contents: fixed }),
      });
      const imageId: string = upload?.id;
      if (!imageId) throw new Error("upload_no_id");

      await pf(`/shops/${PRINTIFY_SHOP_ID}/products/${t.printify_id}.json`, {
        method: "PUT",
        body: JSON.stringify({
          print_areas: [{
            variant_ids: entry.variant_ids,
            placeholders: [{
              position: entry.primary_placeholder.position,
              images: [placeholderPlacement(spec, imageId)],
            }],
          }],
        }),
      });

      // Unpublish + re-publish so Etsy receives the rebuilt mockup set.
      await pf(`/shops/${PRINTIFY_SHOP_ID}/products/${t.printify_id}/unpublish.json`, { method: "POST" }).catch(() => {});
      await pf(`/shops/${PRINTIFY_SHOP_ID}/products/${t.printify_id}/publish.json`, {
        method: "POST",
        body: JSON.stringify({
          title: true, description: true, images: true,
          variants: true, tags: true, keyFeatures: true, shipping_template: true,
        }),
      });

      await sb.from("pod_listings").update({
        status: "publishing",
        republished_at: new Date().toISOString(),
        image_prompt: prompt,
      }).eq("id", t.id);

      // Mark audit row resolved
      await sb.from("pod_dimension_audit").insert({
        listing_id: t.id, printify_id: t.printify_id, product_type: t.product_type,
        expected_w: spec.width, expected_h: spec.height,
        actual_w: spec.width, actual_h: spec.height,
        bg_mode: spec.bgMode, status: "ok", detail: "repaired",
      });

      results.push({ id: t.id, name: t.product_name, ok: true });
    } catch (e) {
      results.push({ id: t.id, name: t.product_name, ok: false, error: (e as Error).message });
    }
    // Pace requests for Printify rate-limits + image gen cost.
    await new Promise(r => setTimeout(r, 800));
  }

  return new Response(JSON.stringify({
    ok: true,
    total: results.length,
    succeeded: results.filter(r => r.ok).length,
    failed: results.filter(r => !r.ok).length,
    results,
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
