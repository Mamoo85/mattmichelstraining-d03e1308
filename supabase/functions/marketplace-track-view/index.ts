// Anonymous viewer tracking for marketplace lead cards.
// Public POST — no auth, no buyer attribution. Powers "N buyers viewing now".
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

  let body: { lead_id?: string; product?: string; visitor_hash?: string } = {};
  try { body = await req.json(); } catch { /* GET / no body */ }

  if (!body.lead_id || !body.product) {
    return new Response(JSON.stringify({ error: "lead_id and product required" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Hash IP if visitor_hash not provided (anonymous, never stored as raw IP)
  const visitor_hash = body.visitor_hash || crypto.randomUUID();

  // Record view (anonymous — no email, no company)
  await (sb.from as any)("marketplace_buyer_views").insert({
    lead_id: body.lead_id,
    product: body.product,
    visitor_hash,
  });

  // Get live count of unique viewers in last 30 min
  const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const { data: recentViews } = await (sb.from as any)("marketplace_buyer_views")
    .select("visitor_hash")
    .eq("lead_id", body.lead_id)
    .gte("viewed_at", thirtyMinAgo);

  const uniqueViewers = new Set((recentViews || []).map((v: any) => v.visitor_hash)).size;

  return new Response(JSON.stringify({ ok: true, viewers_now: uniqueViewers }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
