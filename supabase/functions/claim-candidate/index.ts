// claim-candidate — POST endpoint
// 48-hour exclusivity lock with atomic race condition prevention.
// Token-secured via hire_alert_clients.dashboard_token.

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
    const { token, candidate_id } = await req.json();

    if (!token || !candidate_id) {
      return new Response(JSON.stringify({ error: "token and candidate_id required" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Validate token
    const { data: client } = await sb
      .from("hire_alert_clients")
      .select("id, company_name, active")
      .eq("dashboard_token", token)
      .single();

    if (!client || !client.active) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Check if THIS client already has a row for this candidate
    const { data: myRow } = await sb
      .from("hire_alert_client_candidates")
      .select("id, claimed_at, claim_expires_at")
      .eq("client_id", client.id)
      .eq("candidate_id", candidate_id)
      .single();

    if (!myRow) {
      return new Response(JSON.stringify({ error: "candidate not found in your alerts" }), {
        status: 404, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Check if ANYONE else has an active claim on this candidate
    const now = new Date().toISOString();
    const { data: existingClaims } = await sb
      .from("hire_alert_client_candidates")
      .select("client_id, claimed_at, claim_expires_at")
      .eq("candidate_id", candidate_id)
      .not("claimed_at", "is", null)
      .gt("claim_expires_at", now);

    const otherClaim = (existingClaims || []).find((c: any) => c.client_id !== client.id);

    if (otherClaim) {
      // Already claimed by another company
      return new Response(JSON.stringify({
        claimed: false,
        message: "1 company has claimed this candidate — you'll be notified if they pass.",
      }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Atomic claim: only set if unclaimed or expired
    // Race condition fix: WHERE claimed_at IS NULL OR claim_expires_at < now()
    const claimAt = new Date();
    const expiresAt = new Date(claimAt.getTime() + 48 * 60 * 60 * 1000);

    const { data: updated, error: updateErr } = await sb
      .from("hire_alert_client_candidates")
      .update({
        claimed_at: claimAt.toISOString(),
        claim_expires_at: expiresAt.toISOString(),
      })
      .eq("id", myRow.id)
      .or(`claimed_at.is.null,claim_expires_at.lt.${now}`)
      .select("id")
      .single();

    if (updateErr || !updated) {
      // Lost the race — someone else claimed in the meantime
      return new Response(JSON.stringify({
        claimed: false,
        message: "1 company has claimed this candidate — you'll be notified if they pass.",
      }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      claimed: true,
      expires_at: expiresAt.toISOString(),
      message: `Claimed! You have 48 hours of exclusivity.`,
    }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[claim-candidate]", e);
    return new Response(JSON.stringify({ error: "internal error" }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
