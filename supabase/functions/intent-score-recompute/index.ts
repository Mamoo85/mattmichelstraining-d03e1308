/**
 * intent-score-recompute
 *
 * Batch recomputes intent scores for every account that has had a signal
 * in the last 180 days. Writes a snapshot per account so we have trajectory
 * history. Computes is_surging / is_at_risk by comparing to last week's score.
 *
 * Schedule: every 6 hours (cron added separately).
 * Idempotent: re-runs are safe; new snapshot row each time.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  computeIntentScore,
  accountKey,
  type SignalRow,
  type WeightRow,
} from "../_shared/intent-score.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const LOOKBACK_DAYS = 180;
const SURGE_DELTA_THRESHOLD = 20;     // +20 in 14d = surging
const AT_RISK_DROP_THRESHOLD = 20;    // -20 from peak = at-risk
const AT_RISK_PEAK_FLOOR = 70;        // must have been hot before

interface AccountAccumulator {
  account_key: string;
  company_name: string | null;
  location: string | null;
  vertical: string | null;
  lat: number | null;
  lng: number | null;
  signals: SignalRow[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const startedAt = Date.now();
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    // 1. Load global default weights
    const { data: weightsRaw, error: wErr } = await supabase
      .from("signal_weights_config")
      .select("signal_type, weight, half_life_days, category, display_label")
      .is("user_id", null);

    if (wErr) throw new Error(`load weights: ${wErr.message}`);
    const weights: WeightRow[] = weightsRaw || [];
    if (weights.length === 0) {
      return new Response(JSON.stringify({ error: "no weights configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Load all signals from last 180d
    const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const { data: signals, error: sErr } = await supabase
      .from("industry_pulse_signals")
      .select("id, company_name, location, vertical, lat, lng, signal_type, detected_at, confidence")
      .gte("detected_at", since)
      .not("company_name", "is", null);

    if (sErr) throw new Error(`load signals: ${sErr.message}`);
    if (!signals || signals.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, accounts_processed: 0, signals_loaded: 0, ms: Date.now() - startedAt }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 3. Group by account_key
    const accounts = new Map<string, AccountAccumulator>();
    for (const s of signals) {
      const key = accountKey(s.company_name, s.location);
      let acc = accounts.get(key);
      if (!acc) {
        acc = {
          account_key: key,
          company_name: s.company_name,
          location: s.location,
          vertical: s.vertical,
          lat: s.lat ?? null,
          lng: s.lng ?? null,
          signals: [],
        };
        accounts.set(key, acc);
      }
      // Prefer non-null geo if any signal has it
      if (acc.lat == null && s.lat != null) { acc.lat = s.lat; acc.lng = s.lng; }
      acc.signals.push({
        id: s.id,
        signal_type: s.signal_type,
        detected_at: s.detected_at,
        confidence: s.confidence,
      });
    }

    // 4. Load previous snapshots (latest per account) for trajectory
    const accountKeys = Array.from(accounts.keys());
    const { data: prevSnaps } = await supabase
      .from("v_latest_intent_scores")
      .select("account_key, score, computed_at")
      .in("account_key", accountKeys);

    const prevByKey = new Map<string, { score: number; computed_at: string }>();
    for (const p of prevSnaps || []) prevByKey.set(p.account_key, { score: Number(p.score), computed_at: p.computed_at });

    // 5. Load 14d-ago snapshots for trajectory delta
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: hist } = await supabase
      .from("intent_score_snapshots")
      .select("account_key, score, computed_at")
      .in("account_key", accountKeys)
      .gte("computed_at", fourteenDaysAgo)
      .order("computed_at", { ascending: true });

    // For each account, find earliest snapshot in 14d window
    const earliest14d = new Map<string, number>();
    const earliest7d = new Map<string, number>();
    for (const h of hist || []) {
      if (!earliest14d.has(h.account_key)) earliest14d.set(h.account_key, Number(h.score));
      if (h.computed_at >= sevenDaysAgo && !earliest7d.has(h.account_key)) {
        earliest7d.set(h.account_key, Number(h.score));
      }
    }

    // Track per-account 14d peak for at-risk detection
    const peak14d = new Map<string, number>();
    for (const h of hist || []) {
      const cur = peak14d.get(h.account_key) ?? 0;
      const score = Number(h.score);
      if (score > cur) peak14d.set(h.account_key, score);
    }

    // 6. Compute new scores and prepare batch insert
    const now = new Date();
    const rows: any[] = [];
    let surging = 0;
    let atRisk = 0;
    let budgetReleased = 0;

    for (const acc of accounts.values()) {
      const result = computeIntentScore(acc.signals, weights, now);

      const prev14 = earliest14d.get(acc.account_key);
      const prev7 = earliest7d.get(acc.account_key);
      const peak = peak14d.get(acc.account_key) ?? result.score;

      const delta14d = prev14 != null ? Math.round((result.score - prev14) * 100) / 100 : null;
      const delta7d = prev7 != null ? Math.round((result.score - prev7) * 100) / 100 : null;

      const isSurging = delta14d != null && delta14d >= SURGE_DELTA_THRESHOLD && result.score >= 60;
      const isAtRisk =
        peak >= AT_RISK_PEAK_FLOOR &&
        result.score < peak - AT_RISK_DROP_THRESHOLD &&
        result.score < 70;

      if (isSurging) surging++;
      if (isAtRisk) atRisk++;
      if (result.is_budget_released) budgetReleased++;

      rows.push({
        account_key: acc.account_key,
        company_name: acc.company_name,
        location: acc.location,
        vertical: acc.vertical,
        score: result.score,
        signal_count: result.signal_count,
        category_count: result.category_count,
        stacking_multiplier: result.stacking_multiplier,
        tier: result.tier,
        trajectory_delta_7d: delta7d,
        trajectory_delta_14d: delta14d,
        contributing_signals: result.contributing_signals,
        lat: acc.lat,
        lng: acc.lng,
        is_surging: isSurging,
        is_at_risk: isAtRisk,
        is_budget_released: result.is_budget_released,
      });
    }

    // 7. Batch insert (chunks of 500 to stay under PG limits)
    const CHUNK = 500;
    let inserted = 0;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK);
      const { error: iErr } = await supabase.from("intent_score_snapshots").insert(chunk);
      if (iErr) {
        console.error(`chunk ${i} insert failed:`, iErr.message);
        throw new Error(`insert: ${iErr.message}`);
      }
      inserted += chunk.length;
    }

    return new Response(
      JSON.stringify({
        ok: true,
        accounts_processed: accounts.size,
        signals_loaded: signals.length,
        snapshots_inserted: inserted,
        surging,
        at_risk: atRisk,
        budget_released: budgetReleased,
        ms: Date.now() - startedAt,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    console.error("intent-score-recompute failed:", msg);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
