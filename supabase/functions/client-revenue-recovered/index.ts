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
    const clientType = url.searchParams.get("client_type") || "techalert";

    if (!token) {
      return new Response(JSON.stringify({ error: "Missing token" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

    if (clientType === "techalert") {
      // Validate TechAlert client
      const { data: client } = await sb.from("hire_alert_clients")
        .select("id")
        .eq("dashboard_token", token)
        .eq("active", true)
        .maybeSingle();

      if (!client) {
        return new Response(JSON.stringify({ error: "Invalid token" }), {
          status: 401, headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      // Count hired placements in last 90 days
      const { count } = await sb.from("hire_alert_client_candidates")
        .select("id", { count: "exact", head: true })
        .eq("client_id", client.id)
        .eq("client_action", "hired")
        .gte("alerted_at", ninetyDaysAgo);

      const hiredCount = count || 0;
      const totalRecoveredCents = hiredCount * 800000; // $8,000 per placement

      return new Response(JSON.stringify({
        total_recovered_cents: totalRecoveredCents,
        placements: hiredCount,
        period: "90d",
      }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    } else {
      // Contractor client — validate via roi_token
      const { data: contractor } = await sb.from("contractor_clients")
        .select("id")
        .eq("roi_token", token)
        .eq("active", true)
        .maybeSingle();

      if (!contractor) {
        return new Response(JSON.stringify({ error: "Invalid token" }), {
          status: 401, headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      // Sum dead_lead_charges in last 90 days
      const { data: charges } = await sb.from("dead_lead_charges")
        .select("amount_cents")
        .eq("contractor_id", contractor.id)
        .eq("status", "succeeded")
        .gte("created_at", ninetyDaysAgo);

      const totalRecoveredCents = (charges || []).reduce((sum: number, c: any) => sum + (c.amount_cents || 0), 0);

      return new Response(JSON.stringify({
        total_recovered_cents: totalRecoveredCents,
        period: "90d",
      }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[client-revenue-recovered]", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
