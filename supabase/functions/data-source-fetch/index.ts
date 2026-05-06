// Generic data-source fetcher. Admin calls this to refresh any of the 50 sources.
// POST { source_id, params: {...}, force_refresh?: boolean }
import { createClient } from "npm:@supabase/supabase-js@2";
import { cachedFetch, dispatchFetch, getSource, SOURCES } from "../_shared/sources/index.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return new Response(JSON.stringify({ error: "supabase env missing" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const sb = createClient(SUPABASE_URL, SERVICE_KEY);

  // GET → return registry
  if (req.method === "GET") {
    const url = new URL(req.url);
    if (url.searchParams.get("list") === "1") {
      const { data: status } = await sb
        .from("data_source_cache")
        .select("source_id, fetched_at, row_count, fetch_error")
        .order("fetched_at", { ascending: false });
      const byId: Record<string, any> = {};
      (status ?? []).forEach((r: any) => { if (!byId[r.source_id]) byId[r.source_id] = r; });
      return new Response(JSON.stringify({
        sources: SOURCES.map(s => ({ ...s, status: byId[s.id] ?? null })),
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  }

  let body: any = {};
  try { body = await req.json(); } catch { /* allow empty */ }
  const { source_id, params = {}, force_refresh = false } = body;

  if (!source_id || typeof source_id !== "string") {
    return new Response(JSON.stringify({ error: "source_id required" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const meta = getSource(source_id);
  if (!meta) {
    return new Response(JSON.stringify({ error: `unknown source: ${source_id}` }), {
      status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const cacheKey = JSON.stringify(params);

  // Optionally bust the cache
  if (force_refresh) {
    await sb.from("data_source_cache").delete().eq("source_id", source_id).eq("cache_key", cacheKey);
  }

  const result = await cachedFetch(sb, source_id, cacheKey, () => dispatchFetch(source_id, params));

  return new Response(JSON.stringify(result), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
