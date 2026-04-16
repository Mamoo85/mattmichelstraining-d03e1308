// update-candidate-action — POST endpoint
// Token-secured. Updates client_action on hire_alert_client_candidates.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VALID_ACTIONS = ["viewed", "contacted", "hired"];

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

    // Update the client_action
    const { error } = await sb
      .from("hire_alert_client_candidates")
      .update({ client_action: action })
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
