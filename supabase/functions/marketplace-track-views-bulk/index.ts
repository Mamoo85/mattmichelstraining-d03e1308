// Bulk anonymous viewer tracking — replaces N+1 per-card calls with a single batched insert.
// Public POST. No auth, no buyer attribution.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  let body: { lead_ids?: string[]; product?: string; visitor_hash?: string } = {};
  try { body = await req.json(); } catch { /* noop */ }

  const leadIds = Array.isArray(body.lead_ids) ? body.lead_ids.filter((x) => typeof x === "string").slice(0, 100) : [];
  if (!body.product || leadIds.length === 0) {
    return new Response(JSON.stringify({ error: "product and lead_ids[] required" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const visitor_hash = body.visitor_hash || crypto.randomUUID();

  // Single bulk insert
  const rows = leadIds.map((lead_id) => ({
    lead_id,
    product: body.product,
    visitor_hash,
  }));
  await (sb.from as any)("marketplace_buyer_views").insert(rows);

  // Single aggregate query — viewer counts per lead in last 30 min
  const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const { data: recent } = await (sb.from as any)("marketplace_buyer_views")
    .select("lead_id, visitor_hash")
    .in("lead_id", leadIds)
    .gte("viewed_at", thirtyMinAgo);

  const viewersMap: Record<string, number> = {};
  const seen: Record<string, Set<string>> = {};
  (recent || []).forEach((r: any) => {
    seen[r.lead_id] = seen[r.lead_id] || new Set();
    seen[r.lead_id].add(r.visitor_hash);
  });
  Object.keys(seen).forEach((id) => { viewersMap[id] = seen[id].size; });

  return new Response(JSON.stringify({ ok: true, viewers: viewersMap }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
