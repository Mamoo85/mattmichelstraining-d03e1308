// Sync cleaned title/description/tags from pod_listings -> Printify -> Etsy.
// Everything routes through Printify (registered Etsy OAuth app); we never
// call Etsy directly. Flow per listing:
//   1) PUT /v1/shops/{shop}/products/{id}.json  (title, description, tags)
//   2) POST /v1/shops/{shop}/products/{id}/publish.json  (push to Etsy)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const PRINTIFY_TOKEN = Deno.env.get("PRINTIFY_API_TOKEN")!;
const PRINTIFY_SHOP_ID = Deno.env.get("PRINTIFY_SHOP_ID")!;
const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const primary = createClient(SB_URL, SB_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function clampTitle(t: string): string {
  return (t || "").trim().slice(0, 140);
}
function cleanDesc(d: string): string {
  return (d || "").replace(/\r\n/g, "\n").trim().slice(0, 4000);
}
function sanitizeTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags) {
    const t = String(raw || "")
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 20);
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
    if (out.length >= 13) break;
  }
  return out;
}

async function logStage(listing_id: string, ok: boolean, payload: unknown, error?: string) {
  await primary.from("pod_publish_logs").insert({
    listing_id,
    stage: "etsy_update_copy",
    ok,
    payload,
    error: error ?? null,
  });
}

async function syncOne(row: any) {
  const printify_id = row.printify_id;
  const body = {
    title: clampTitle(row.title || row.product_name || ""),
    description: cleanDesc(row.description || ""),
    tags: sanitizeTags(row.tags),
  };

  // 1) Update product on Printify
  const putRes = await fetch(
    `https://api.printify.com/v1/shops/${PRINTIFY_SHOP_ID}/products/${printify_id}.json`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${PRINTIFY_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );
  if (!putRes.ok) {
    const text = await putRes.text();
    const err = `printify PUT ${putRes.status}: ${text.slice(0, 300)}`;
    await logStage(row.id, false, { printify_id, body }, err);
    return { id: row.id, ok: false, error: err };
  }

  // 2) Re-publish to push the new copy to Etsy
  const pubRes = await fetch(
    `https://api.printify.com/v1/shops/${PRINTIFY_SHOP_ID}/products/${printify_id}/publish.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PRINTIFY_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: true,
        description: true,
        tags: true,
        images: false,
        variants: false,
        keyFeatures: false,
        shipping_template: false,
      }),
    },
  );
  if (!pubRes.ok) {
    const text = await pubRes.text();
    const err = `printify publish ${pubRes.status}: ${text.slice(0, 300)}`;
    await logStage(row.id, false, { printify_id, body }, err);
    return { id: row.id, ok: false, error: err };
  }

  await primary.from("pod_listings").update({ last_synced_at: new Date().toISOString() }).eq("id", row.id);
  await logStage(row.id, true, { printify_id, body });
  return { id: row.id, ok: true };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  if (url.searchParams.get("diag") === "1") {
    return new Response(JSON.stringify({
      printify_token_len: PRINTIFY_TOKEN?.length ?? 0,
      printify_shop_id: PRINTIFY_SHOP_ID,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
    const limit = Number(url.searchParams.get("limit") || "0");
    let q = primary
      .from("pod_listings")
      .select("id, printify_id, etsy_listing_id, product_name, title, description, tags")
      .not("etsy_listing_id", "is", null)
      .not("printify_id", "is", null);
    if (limit > 0) q = q.limit(limit);
    const { data: listings, error } = await q;
    if (error) throw error;

    const rows = listings ?? [];
    // Process in parallel — Printify accepts concurrent requests
    const results = await Promise.all(rows.map((r) => syncOne(r).catch((e) => ({ id: r.id, ok: false, error: String(e) }))));

    return new Response(JSON.stringify({
      total: results.length,
      ok: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
      results,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
