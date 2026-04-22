// industrial-pulse-unlock-preview (Channel 3 — gated)
// POST { email } → after Stripe success, returns 3 EXTRA real signals (un-redacted) for the buyer
// to see immediate value while the full email digest is being composed/delivered.
// Verifies the email has an active or pending unlock row in industrial_pulse_unlocks.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { email } = await req.json().catch(() => ({}));
    if (!email || typeof email !== "string" || !email.includes("@")) {
      return new Response(JSON.stringify({ error: "Valid email required", entitled: false, signals: [] }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const normalizedEmail = email.trim().toLowerCase();

    // Verify entitlement — must have an unlock row (active OR pending — pending covers the
    // narrow window between Stripe redirect and webhook fulfillment).
    const { data: unlock } = await sb
      .from("industrial_pulse_unlocks")
      .select("id, status, plan, week_start")
      .eq("email", normalizedEmail)
      .in("status", ["active", "pending"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!unlock) {
      return new Response(JSON.stringify({ entitled: false, signals: [], reason: "no_unlock" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Pull 3 high-confidence signals from the last 7 days — REAL company names this time.
    // These are the "extra" preview rows so the buyer sees value before the full email arrives.
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: signals, error } = await sb
      .from("industry_pulse_signals")
      .select("id, company_name, location, industry, hiring_roles, hiring_count, predicted_needs, confidence, detected_at, recommended_pitch")
      .gte("detected_at", sevenDaysAgo)
      .gte("confidence", 7)
      .order("confidence", { ascending: false })
      .order("detected_at", { ascending: false })
      .limit(3);

    if (error) throw error;

    const previewSignals = (signals || []).map(s => ({
      id: s.id,
      company_name: s.company_name,
      location: s.location,
      industry: s.industry,
      hiring_roles: s.hiring_roles || [],
      hiring_count: s.hiring_count,
      predicted_needs: s.predicted_needs || [],
      confidence: s.confidence,
      detected_at: s.detected_at,
      recommended_pitch: s.recommended_pitch,
    }));

    return new Response(JSON.stringify({
      entitled: true,
      status: unlock.status,
      plan: unlock.plan,
      signals: previewSignals,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[industrial-pulse-unlock-preview]", msg);
    return new Response(JSON.stringify({ error: msg, entitled: false, signals: [] }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
