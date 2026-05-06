// trade-radar-api — $49/mo developer API for Trade Radar signals.
// JWT auth via api_key query param or Authorization header.
// GET /trade-radar-api?vertical=roofing&zip=48201&since=2026-05-01&limit=50
// Returns leads from trade_radar_leads for the authenticated client's vertical + zips.

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);

  // Auth: Bearer token or api_key query param
  const authHeader = req.headers.get("authorization") || "";
  const apiKey = url.searchParams.get("api_key") || authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!apiKey) return jsonResponse({ error: "api_key required" }, 401);

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE);

  // Look up client by api_key
  const { data: client } = await sb
    .from("trade_radar_clients")
    .select("id, email, vertical, zip_codes, api_tier, active")
    .eq("api_key", apiKey)
    .eq("active", true)
    .maybeSingle();

  if (!client) return jsonResponse({ error: "invalid or inactive api_key" }, 401);
  if (!client.api_tier) return jsonResponse({ error: "API access not enabled — upgrade at detroitwebagent.com/trade-radar-api" }, 403);

  // Query params
  const vertical = url.searchParams.get("vertical") || client.vertical;
  const zipParam = url.searchParams.get("zip");
  const since = url.searchParams.get("since");
  const limit = Math.min(Number(url.searchParams.get("limit") || "50"), 200);

  // Build lead query
  let query = sb
    .from("trade_radar_leads")
    .select("id, address, city, zip, signal_type, signal_date, score, estimated_job_value, owner_name, street_view_url, created_at")
    .eq("vertical", vertical)
    .order("score", { ascending: false })
    .limit(limit);

  // Restrict to client's authorized ZIP codes unless a specific ZIP is requested
  const allowedZips: string[] = client.zip_codes || [];
  if (zipParam) {
    if (allowedZips.length && !allowedZips.includes(zipParam)) {
      return jsonResponse({ error: "zip not in your coverage area" }, 403);
    }
    query = query.eq("zip", zipParam);
  } else if (allowedZips.length) {
    query = query.in("zip", allowedZips);
  }

  if (since) {
    query = query.gte("signal_date", since);
  } else {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);
    query = query.gte("signal_date", thirtyDaysAgo);
  }

  const { data: leads, error } = await query;
  if (error) return jsonResponse({ error: "query failed" }, 500);

  return jsonResponse({
    ok: true,
    vertical,
    count: leads?.length ?? 0,
    leads: leads || [],
    _meta: { client_id: client.id, tier: client.api_tier },
  });
});
