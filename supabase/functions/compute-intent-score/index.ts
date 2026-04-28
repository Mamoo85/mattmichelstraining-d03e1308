/**
 * compute-intent-score
 * On-demand score computation for a single account.
 * Used when the user clicks an account or after editing signal weights.
 *
 * POST { account_key: string }
 * → Returns full breakdown (score + tier + contributing_signals + trajectory)
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { computeIntentScore, type SignalRow, type WeightRow } from "../_shared/intent-score.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const accountKey: string | undefined = body?.account_key;
    if (!accountKey || typeof accountKey !== "string") {
      return new Response(JSON.stringify({ error: "account_key required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const userId: string | undefined = body?.user_id;

    // Load weights — prefer user override, fall back to global default
    let weights: WeightRow[] = [];
    if (userId) {
      const { data: userW } = await supabase
        .from("signal_weights_config")
        .select("signal_type, weight, half_life_days, category, display_label")
        .eq("user_id", userId);
      if (userW && userW.length > 0) weights = userW;
    }
    if (weights.length === 0) {
      const { data: defW, error: wErr } = await supabase
        .from("signal_weights_config")
        .select("signal_type, weight, half_life_days, category, display_label")
        .is("user_id", null);
      if (wErr) throw new Error(`weights: ${wErr.message}`);
      weights = defW || [];
    }

    // Resolve account_key → company_name + location for the signal lookup
    // We stored account_key on snapshots; use the latest snapshot to get company_name
    const { data: latest } = await supabase
      .from("v_latest_intent_scores")
      .select("company_name, location, vertical, lat, lng")
      .eq("account_key", accountKey)
      .maybeSingle();

    if (!latest) {
      return new Response(JSON.stringify({ error: "account not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load all signals matching this company+location (last 180d)
    const since = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString();
    const { data: signals, error: sErr } = await supabase
      .from("industry_pulse_signals")
      .select("id, signal_type, detected_at, confidence")
      .eq("company_name", latest.company_name)
      .eq("location", latest.location)
      .gte("detected_at", since);

    if (sErr) throw new Error(`signals: ${sErr.message}`);

    const result = computeIntentScore((signals || []) as SignalRow[], weights);

    return new Response(
      JSON.stringify({
        ok: true,
        account_key: accountKey,
        company_name: latest.company_name,
        location: latest.location,
        vertical: latest.vertical,
        lat: latest.lat,
        lng: latest.lng,
        ...result,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    console.error("compute-intent-score failed:", msg);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
