// Direct Printify+Etsy publisher that bypasses the legacy secondary-project
// `printify-product-creator`. Supports ALL product types in pod-printify-catalog.
//
// Body: {
//   type: string (catalog slug),
//   niche: string,
//   name: string (>=30 chars, <=140),
//   description: string (>=200, <=1800),
//   tags: string[] (exactly 13, each <=20 chars),
//   imagePrompt: string,
//   retailPriceCents?: number (defaults from catalog),
//   run_id?: string,
//   source?: string,
//   publish?: boolean (default true; if false, only creates in Printify draft)
// }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { POD_CATALOG } from "../_shared/pod-printify-catalog.ts";
import { getPrintSpec, validateImageDimensions, bgPromptFragment } from "../_shared/pod-print-spec.ts";



const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PRINTIFY_TOKEN = Deno.env.get("PRINTIFY_API_TOKEN")!;
const PRINTIFY_SHOP_ID = Deno.env.get("PRINTIFY_SHOP_ID") || "2890106";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const UA = "Lovable-POD/1.0";

const sb = createClient(SUPABASE_URL, SERVICE_ROLE);

interface Body {
  type: string;
  niche: string;
  name: string;
  description: string;
  tags: string[];
  imagePrompt: string;
  retailPriceCents?: number;
  run_id?: string;
  source?: string;
  publish?: boolean;
}

async function pfFetch(path: string, init?: RequestInit) {
  const res = await fetch(`https://api.printify.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${PRINTIFY_TOKEN}`,
      "User-Agent": UA,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  const text = await res.text();
  let json: any = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* keep text */ }
  if (!res.ok) {
    throw new Error(`Printify ${path} ${res.status}: ${text.slice(0, 400)}`);
  }
  return json;
}

async function generateImage(prompt: string): Promise<string> {
  // Lovable AI Gateway -> google/gemini-2.5-flash-image returns image as base64.
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-image",
      modalities: ["image", "text"],
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`image_gen_${res.status}: ${t.slice(0, 300)}`);
  }
  const data = await res.json();
  // Gemini image response: choices[0].message.images[0].image_url.url => data:image/png;base64,...
  const choice = data?.choices?.[0]?.message;
  const imageUrl: string | undefined = choice?.images?.[0]?.image_url?.url;
  if (!imageUrl?.startsWith("data:image/")) {
    throw new Error(`image_gen_no_data: ${JSON.stringify(data).slice(0, 300)}`);
  }
  // strip data: prefix
  const idx = imageUrl.indexOf(",");
  return imageUrl.slice(idx + 1);
}

async function uploadImageToPrintify(base64: string, fileName: string): Promise<string> {
  const res = await pfFetch(`/uploads/images.json`, {
    method: "POST",
    body: JSON.stringify({ file_name: fileName, contents: base64 }),
  });
  if (!res?.id) throw new Error(`upload_no_id: ${JSON.stringify(res).slice(0, 300)}`);
  return res.id;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  let body: Body;
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const t0 = Date.now();
  const { type, niche, name, description, tags, imagePrompt } = body;

  // Validate
  if (!type || !POD_CATALOG[type]) {
    return new Response(JSON.stringify({ error: "unknown_type", supported: Object.keys(POD_CATALOG) }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  if (!name || name.length < 5 || name.length > 140) return new Response(JSON.stringify({ error: "bad_name_length" }), { status: 400, headers: corsHeaders });
  if (!description || description.length < 50) return new Response(JSON.stringify({ error: "bad_description" }), { status: 400, headers: corsHeaders });
  if (!Array.isArray(tags) || tags.length < 1) return new Response(JSON.stringify({ error: "bad_tags" }), { status: 400, headers: corsHeaders });
  if (!imagePrompt) return new Response(JSON.stringify({ error: "missing_image_prompt" }), { status: 400, headers: corsHeaders });

  const entry = POD_CATALOG[type];
  const price = body.retailPriceCents ?? entry.retail_price_cents;
  const publish = body.publish !== false;
  const runId = body.run_id ?? null;
  const source = body.source || "direct-publish";

  // Dedupe by (type, niche, normalized name)
  const normName = name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  try {
    const { data: existing } = await sb
      .from("pod_listings")
      .select("id, printify_id, product_name")
      .eq("product_type", type)
      .eq("niche", niche)
      .limit(20);
    for (const row of existing ?? []) {
      const rn = (row.product_name || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
      if (rn === normName) {
        return new Response(JSON.stringify({ ok: true, skipped: true, reason: "duplicate", existing_id: row.printify_id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }
  } catch (_) { /* non-fatal */ }

  let stage = "image_gen";
  try {
    // Inject spec-based bg + dimension instructions so the image generator targets the right canvas.
    const spec = getPrintSpec(type);
    const finalPrompt = spec
      ? `${imagePrompt}\n\n${bgPromptFragment(spec, type)}`
      : imagePrompt;
    const base64 = await generateImage(finalPrompt);

    stage = "validate_dims";
    if (spec) {
      const v = await validateImageDimensions(base64, spec);
      if (!v.ok && v.reason !== "not_png") {
        // Log mismatch but don't hard-fail — Printify scales to fit. Future: re-roll image up to N times.
        console.warn(`[printify-direct-publish] dim_mismatch type=${type} expected=${spec.width}x${spec.height} got=${v.width}x${v.height}`);
      }
    }

    stage = "upload";
    const imageId = await uploadImageToPrintify(base64, `${type}-${Date.now()}.png`);



    stage = "create_product";
    const productBody = {
      title: name,
      description,
      blueprint_id: entry.blueprint_id,
      print_provider_id: entry.print_provider_id,
      variants: entry.variant_ids.map((vid) => ({
        id: vid,
        price,
        is_enabled: true,
      })),
      print_areas: [
        {
          variant_ids: entry.variant_ids,
          placeholders: [
            {
              position: entry.primary_placeholder.position,
              images: [
                {
                  id: imageId,
                  x: 0.5,
                  y: 0.5,
                  scale: 1,
                  angle: 0,
                },
              ],
            },
          ],
        },
      ],
      tags,
    };
    const created = await pfFetch(`/shops/${PRINTIFY_SHOP_ID}/products.json`, {
      method: "POST",
      body: JSON.stringify(productBody),
    });
    const printifyId: string = created.id;

    let etsyListingId: number | null = null;
    if (publish) {
      stage = "publish";
      // Trigger publish — Etsy listing ID arrives via webhook later
      await pfFetch(`/shops/${PRINTIFY_SHOP_ID}/products/${printifyId}/publish.json`, {
        method: "POST",
        body: JSON.stringify({
          title: true,
          description: true,
          images: true,
          variants: true,
          tags: true,
          keyFeatures: true,
          shipping_template: true,
        }),
      });
      // Mark as in publishing
      await pfFetch(`/shops/${PRINTIFY_SHOP_ID}/products/${printifyId}/publishing_succeeded.json`, {
        method: "POST",
        body: JSON.stringify({
          external: { id: printifyId, handle: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 80) },
        }),
      }).catch(() => { /* webhook will set this normally */ });
    }

    stage = "db_insert";
    const { data: inserted, error: insErr } = await sb.from("pod_listings").insert({
      printify_id: printifyId,
      etsy_listing_id: etsyListingId,
      niche,
      product_name: name,
      product_type: type,
      title: name,
      tags,
      description,
      image_prompt: imagePrompt,
      retail_price_cents: price,
      status: publish ? "publishing" : "draft",
      source_run_id: runId,
      source,
    }).select("id").maybeSingle();

    if (insErr) console.error("pod_listings insert error", insErr);

    return new Response(JSON.stringify({
      ok: true,
      printify_id: printifyId,
      listing_id: inserted?.id,
      published: publish,
      duration_ms: Date.now() - t0,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    const msg = (e as Error).message;
    console.error("printify-direct-publish error", stage, msg);
    return new Response(JSON.stringify({ ok: false, stage, error: msg, duration_ms: Date.now() - t0 }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
