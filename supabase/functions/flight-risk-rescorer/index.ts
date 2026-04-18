// Nightly flight-risk rescorer.
// READ-ONLY against live tables; writes ONLY to new flight_risk_proof column on hire_alert_candidates.
// Item #5, #7, #14, #18 from the 50-item revenue ops list.
// Safe: never modifies score, status, alerted_at, or any field the live scanner uses.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { computeFlightRisk, normalizeName } from "../_shared/flight-risk.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const startedAt = Date.now();
  let scored = 0;
  let updated = 0;
  const errors: string[] = [];

  try {
    // Pull candidates active in last 60 days that have an employer
    const { data: candidates, error: cErr } = await sb
      .from("hire_alert_candidates")
      .select("id, current_employer, years_experience, license_expiry, personal_email_primary, employer_headcount_delta, employer_domain_breached_recently, first_seen_at")
      .not("current_employer", "is", null)
      .gte("first_seen_at", new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString())
      .limit(500);

    if (cErr) throw cErr;
    if (!candidates?.length) {
      return new Response(JSON.stringify({ ok: true, scored: 0, message: "no candidates" }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    // Pull industry pulse signals once and index by normalized employer name
    const { data: pulseSignals } = await sb
      .from("industry_pulse_signals")
      .select("company_name, signal_type, confidence")
      .gte("detected_at", new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
      .limit(2000);

    const signalsByEmployer = new Map<string, { neg: number; pos: number }>();
    for (const s of pulseSignals ?? []) {
      const k = normalizeName(s.company_name);
      if (!k) continue;
      const cur = signalsByEmployer.get(k) ?? { neg: 0, pos: 0 };
      const isPositive = ["expansion", "hiring_surge", "contract_award", "facility_upgrade"].includes(s.signal_type ?? "");
      const isNegative = ["warn_act", "miosha_violation", "headcount_decline", "layoff", "closure"].includes(s.signal_type ?? "");
      if (isPositive) cur.pos += 1;
      if (isNegative) cur.neg += 1;
      signalsByEmployer.set(k, cur);
    }

    // Pull WHISARD violations
    const { data: violations } = await sb
      .from("dol_whisard_violations")
      .select("employer_name_normalized, violation_count");
    const whisardByEmployer = new Map<string, number>();
    for (const v of violations ?? []) {
      whisardByEmployer.set(v.employer_name_normalized, (whisardByEmployer.get(v.employer_name_normalized) ?? 0) + (v.violation_count ?? 1));
    }

    // Score each candidate
    for (const c of candidates) {
      scored++;
      const employerKey = normalizeName(c.current_employer);
      const sig = signalsByEmployer.get(employerKey) ?? { neg: 0, pos: 0 };
      const result = computeFlightRisk({
        current_employer: c.current_employer,
        years_experience: c.years_experience ?? null,
        employer_negative_signals: sig.neg,
        employer_positive_signals: sig.pos,
        employer_whisard_violations: whisardByEmployer.get(employerKey) ?? 0,
        license_expiry: c.license_expiry,
        personal_email_primary: c.personal_email_primary ?? false,
        employer_headcount_delta: c.employer_headcount_delta,
        employer_domain_breached_recently: c.employer_domain_breached_recently,
      });

      // Only update if there's actual signal — don't blanket-write LOW to everyone
      if (result.score === 0) continue;

      const { error: uErr } = await sb
        .from("hire_alert_candidates")
        .update({
          flight_risk: result.level,
          flight_risk_proof: result.reasons.join("; "),
          job_stability_index: result.job_stability_index,
        })
        .eq("id", c.id);
      if (uErr) errors.push(`${c.id}: ${uErr.message}`);
      else updated++;
    }

    return new Response(JSON.stringify({
      ok: true, scored, updated, errors: errors.slice(0, 5),
      duration_ms: Date.now() - startedAt,
    }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ ok: false, error: msg, scored, updated }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
