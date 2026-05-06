// Demand Radar — log a client action on a signal (contacted / won / lost / passed)
// Called from MyIndustryPulse.tsx action buttons. Token-authenticated, no login required.

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
    const { token, signal_id, company_name, action, deal_value, note } = await req.json();

    if (!token || !signal_id || !action) {
      return new Response(JSON.stringify({ error: "Missing required fields: token, signal_id, action" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const validActions = ["contacted", "won", "lost", "passed"];
    if (!validActions.includes(action)) {
      return new Response(JSON.stringify({ error: `Invalid action. Must be one of: ${validActions.join(", ")}` }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Validate token
    const { data: client } = await sb.from("industry_pulse_clients")
      .select("id, company_name")
      .eq("dashboard_token", token)
      .maybeSingle();

    if (!client) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Upsert — one action state per client per signal
    const { error } = await sb.from("industry_pulse_client_actions").upsert({
      client_id: client.id,
      signal_id,
      company_name: company_name || "Unknown",
      action,
      deal_value: deal_value || 0,
      note: note || null,
    }, { onConflict: "client_id,signal_id" });

    if (error) throw new Error(error.message);

    return new Response(JSON.stringify({ ok: true, action }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[log-industry-pulse-action]", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
