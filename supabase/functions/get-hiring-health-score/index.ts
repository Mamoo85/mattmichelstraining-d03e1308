// get-hiring-health-score — GET endpoint
// Returns pipeline stats + health score for a TechAlert client dashboard

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

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

    if (!token) {
      return new Response(JSON.stringify({ error: "Missing token" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

    const { data: client } = await sb
      .from("hire_alert_clients")
      .select("id")
      .eq("dashboard_token", token)
      .eq("active", true)
      .maybeSingle();

    if (!client) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const { data: candidates } = await sb
      .from("hire_alert_client_candidates")
      .select("pipeline_stage, hired_revenue_estimate")
      .eq("client_id", client.id)
      .gte("alerted_at", ninetyDaysAgo);

    const all = candidates || [];
    const alerted = all.length;
    const viewed = all.filter((c) => ["viewed", "contacted", "interviewed", "hired"].includes(c.pipeline_stage)).length;
    const contacted = all.filter((c) => ["contacted", "interviewed", "hired"].includes(c.pipeline_stage)).length;
    const interviewed = all.filter((c) => ["interviewed", "hired"].includes(c.pipeline_stage)).length;
    const hired = all.filter((c) => c.pipeline_stage === "hired").length;
    const totalRevenue = all
      .filter((c) => c.pipeline_stage === "hired")
      .reduce((sum, c) => sum + (c.hired_revenue_estimate || 0), 0);

    const engagementRate = alerted > 0 ? (all.filter((c) => c.pipeline_stage !== "alerted").length / alerted) * 100 : 0;
    const contactRate = alerted > 0 ? (contacted / alerted) * 100 : 0;
    const hireRate = contacted > 0 ? (hired / contacted) * 100 : 0;

    const healthScore = Math.min(100, Math.round(
      (engagementRate * 0.3) + (contactRate * 0.3) + (hireRate * 0.4)
    ));

    return new Response(JSON.stringify({
      alerted,
      viewed,
      contacted,
      interviewed,
      hired,
      total_revenue: totalRevenue,
      health_score: healthScore,
      engagement_rate: engagementRate,
      contact_rate: contactRate,
      hire_rate: hireRate,
    }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[get-hiring-health-score]", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
