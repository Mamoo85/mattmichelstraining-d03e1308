// Pushes cleaned title/description/tags from pod_listings rows directly
// to Etsy via the Etsy Open API v3 updateListing endpoint.
// POST body: { ids?: string[] }  // optional listing UUIDs; default = all with etsy_listing_id
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ETSY_API_KEY = Deno.env.get("ETSY_API_KEY") ?? "";
const ETSY_ACCESS_TOKEN = Deno.env.get("ETSY_ACCESS_TOKEN") ?? "";
const ETSY_SHOP_ID = Deno.env.get("ETSY_SHOP_ID") ?? "";

const SB_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const sb = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });

function sanitizeTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  const cleaned = tags
    .map((t) => String(t).toLowerCase().replace(/[^a-z0-9 ]/g, "").trim())
    .filter((t) => t.length >= 3 && t.length <= 20);
  const uniq = Array.from(new Set(cleaned));
  return uniq.slice(0, 13);
}

function clampTitle(t: string): string {
  const s = String(t).replace(/\s+/g, " ").trim();
  if (s.length <= 140) return s;
  const cut = s.slice(0, 138);
  const lc = cut.lastIndexOf(",");
  return (lc > 60 ? cut.slice(0, lc) : cut).trim();
}

function cleanDesc(d: string): string {
  return String(d).replace(/^[\s]*[-•*]\s+/gm, "").replace(/\n{3,}/g, "\n\n").trim();
}

async function updateEtsy(listingId: number, title: string, description: string, tags: string[]) {
  const url = `https://openapi.etsy.com/v3/application/shops/${ETSY_SHOP_ID}/listings/${listingId}`;
  const body = new URLSearchParams();
  body.set("title", title);
  body.set("description", description);
  tags.forEach((t) => body.append("tags", t));
  const r = await fetch(url, {
    method: "PATCH",
    headers: {
      "x-api-key": ETSY_API_KEY,
      Authorization: `Bearer ${ETSY_ACCESS_TOKEN}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });
  const text = await r.text();
  return { ok: r.ok, status: r.status, body: text.slice(0, 500) };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  if (url.searchParams.get("diag") === "1") {
    return new Response(JSON.stringify({
      etsy_api_key_len: ETSY_API_KEY.length,
      etsy_access_token_len: ETSY_ACCESS_TOKEN.length,
      etsy_shop_id: ETSY_SHOP_ID,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }



  let ids: string[] | undefined;
  try {
    const j = await req.json();
    if (Array.isArray(j?.ids)) ids = j.ids;
  } catch (_) { /* no body */ }

  let q = sb.from("pod_listings")
    .select("id, etsy_listing_id, title, description, tags")
    .not("etsy_listing_id", "is", null);
  if (ids?.length) q = q.in("id", ids);

  const { data, error } = await q;
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const results: any[] = [];
  for (const row of data ?? []) {
    const title = clampTitle(row.title ?? "");
    const description = cleanDesc(row.description ?? "");
    const tags = sanitizeTags(row.tags);
    if (!title || !description || tags.length === 0) {
      results.push({ id: row.id, etsy_listing_id: row.etsy_listing_id, ok: false, error: "missing fields" });
      continue;
    }
    try {
      const res = await updateEtsy(row.etsy_listing_id, title, description, tags);
      await sb.from("pod_publish_logs").insert({
        listing_id: row.id,
        stage: "etsy_update_copy",
        attempt: 1,
        ok: res.ok,
        error: res.ok ? null : res.body,
        meta: { etsy_listing_id: row.etsy_listing_id, status: res.status, tags_count: tags.length, title_len: title.length },
      });
      results.push({ id: row.id, etsy_listing_id: row.etsy_listing_id, ok: res.ok, status: res.status, error: res.ok ? undefined : res.body });
    } catch (e) {
      results.push({ id: row.id, etsy_listing_id: row.etsy_listing_id, ok: false, error: String(e) });
    }
    await new Promise((r) => setTimeout(r, 500)); // rate-limit gentle
  }

  return new Response(JSON.stringify({
    total: results.length,
    succeeded: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
