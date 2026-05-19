// One-shot fixer for Etsy listings published with only 1 photo.
// Re-triggers Printify -> Etsy publish so Printify pushes its full mockup set
// (front/back/lifestyle/sizing — usually 5-10 images) to Etsy.
//
// Body: { listing_ids?: string[]; product_types?: string[]; limit?: number; dry_run?: boolean }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PRINTIFY_TOKEN = Deno.env.get("PRINTIFY_API_TOKEN")!;
const PRINTIFY_SHOP_ID = Deno.env.get("PRINTIFY_SHOP_ID") || "2890106";

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
  if (!res.ok) throw new Error(`${res.status}: ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const body = await req.json().catch(() => ({}));
  const { listing_ids, product_types, limit = 100, dry_run = false } = body;

  let q = sb.from("pod_listings").select("id, printify_id, product_name, product_type").not("printify_id", "is", null);
  if (listing_ids?.length) q = q.in("id", listing_ids);
  if (product_types?.length) q = q.in("product_type", product_types);
  const { data: listings, error } = await q.limit(limit);
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });

  if (dry_run) {
    return new Response(JSON.stringify({ would_republish: listings?.length, listings }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const results: any[] = [];
  for (const l of listings ?? []) {
    try {
      // Unlock (Printify locks products after Etsy publish completes)
      await pf(`/shops/${PRINTIFY_SHOP_ID}/products/${l.printify_id}/unpublish.json`, { method: "POST" }).catch(() => {});

      // Re-publish — Printify regenerates and pushes the FULL mockup set
      await pf(`/shops/${PRINTIFY_SHOP_ID}/products/${l.printify_id}/publish.json`, {
        method: "POST",
        body: JSON.stringify({
          title: true, description: true, images: true,
          variants: true, tags: true, keyFeatures: true, shipping_template: true,
        }),
      });

      await sb.from("pod_listings").update({ status: "publishing", republished_at: new Date().toISOString() }).eq("id", l.id);
      results.push({ id: l.id, name: l.product_name, ok: true });
    } catch (e) {
      results.push({ id: l.id, name: l.product_name, ok: false, error: (e as Error).message });
    }
    // Stagger to avoid Printify 429s (smaller delay to fit in 150s edge timeout)
    await new Promise(r => setTimeout(r, 600));
  }


  return new Response(JSON.stringify({
    total: results.length,
    succeeded: results.filter(r => r.ok).length,
    failed: results.filter(r => !r.ok).length,
    results,
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
