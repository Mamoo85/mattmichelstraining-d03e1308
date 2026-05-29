// update-candidate-action — POST endpoint
// Token-secured. Updates client_action + pipeline_stage on hire_REDACTED.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VALID_ACTIONS = ["viewed", "contacted", "interviewed", "hired"];

// Average annual revenue generated per hire by role
const ROLE_REVENUE_ESTIMATES: Record<string, number> = {
  hvac: 180000,
  hvac_tech: 180000,
  boiler_operator: 200000,
  plumber: 160000,
  electrician: 175000,
  welder: 150000,
  pipefitter: 165000,
  millwright: 170000,
  industrial_mechanic: 160000,
  pressure_vessel: 190000,
  cna: 65000,
  rn: 120000,
  lpn: 85000,
  director_of_nursing: 150000,
  home_health_aide: 55000,
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const { token, candidate_id, action } = await req.json();

    if (!token || !candidate_id || !action) {
      return new Response(JSON.stringify({ error: "token, candidate_id, and action required" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    if (!VALID_ACTIONS.includes(action)) {
      return new Response(JSON.stringify({ error: "invalid action" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Validate token
    const { data: client } = await sb
      .from("hire_alert_clients")
      .select("id, active")
      .eq("dashboard_token", token)
      .single();

    if (!client || !client.active) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Build update payload
    const updatePayload: Record<string, unknown> = {
      client_action: action,
      pipeline_stage: action, // maps directly: viewed/contacted/interviewed/hired
    };

    // On "hired", calculate revenue estimate from candidate's role
    if (action === "hired") {
      const { data: candidateRow } = await sb
        .from("hire_REDACTED")
        .select("candidate_id")
        .eq("client_id", client.id)
        .eq("candidate_id", candidate_id)
        .single();

      if (candidateRow) {
        const { data: candidate } = await sb
          .from("hire_alert_candidates")
          .select("license_type")
          .eq("id", candidate_id)
          .single();

        const role = candidate?.license_type?.toLowerCase() || "";
        const estimate = ROLE_REVENUE_ESTIMATES[role] || 150000;
        updatePayload.hired_revenue_estimate = estimate;
      }
    }

    // On "interviewed", set interview timestamp
    if (action === "interviewed") {
      updatePayload.interview_scheduled_at = new Date().toISOString();
    }

    // Update the record
    const { error } = await sb
      .from("hire_REDACTED")
      .update(updatePayload)
      .eq("client_id", client.id)
      .eq("candidate_id", candidate_id);

    if (error) {
      console.error("[update-candidate-action]", error);
      return new Response(JSON.stringify({ error: "update failed" }), {
        status: 500,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      hired: action === "hired",
      pipeline_stage: action,
      revenue_estimate: action === "hired" ? updatePayload.hired_revenue_estimate : undefined,
    }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[update-candidate-action]", e);
    return new Response(JSON.stringify({ error: "internal error" }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
