// contractor-roi-report — GET endpoint for the /roi?token=XYZ magic link page
// Looks up contractor by roi_token, returns this week's stats. No auth needed.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    if (!token) return new Response(JSON.stringify({ error: "token required" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const { data: contractor } = await sb
      .from("contractor_clients")
      .select("id, business_name, active")
      .eq("roi_token", token)
      .single();

    if (!contractor || !contractor.active) {
      return new Response(JSON.stringify({ error: "not found" }), { status: 404, headers: { ...cors, "Content-Type": "application/json" } });
    }

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [
      { count: leadsDelivered },
      { count: deadLeadsRevived },
      { count: missedCallsCaught },
      { count: licensesMonitored },
    ] = await Promise.all([
      sb.from("contractor_lead_purchases")
        .select("id", { count: "exact", head: true })
        .eq("contractor_id", contractor.id)
        .gte("created_at", sevenDaysAgo),
      sb.from("dead_lead_contacts" as any)
        .select("id", { count: "exact", head: true })
        .eq("contractor_id", contractor.id)
        .eq("status", "replied_positive")
        .gte("contractor_notified_at", sevenDaysAgo),
      sb.from("system_comms_log")
        .select("id", { count: "exact", head: true })
        .eq("product", "missed_call")
        .gte("created_at", sevenDaysAgo),
      sb.from("license_monitor_items" as any)
        .select("id", { count: "exact", head: true }),
    ]);

    return new Response(JSON.stringify({
      ok: true,
      stats: {
        business_name: contractor.business_name || "Your Business",
        leads_delivered: leadsDelivered || 0,
        dead_leads_revived: deadLeadsRevived || 0,
        missed_calls_caught: missedCallsCaught || 0,
        licenses_monitored: licensesMonitored || 0,
        period_start: sevenDaysAgo,
      },
    }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
