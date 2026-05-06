// candidate-quality-scorer — scores hire_alert_candidates 1-10 + tags FLIGHT RISK by cross-referencing employer activity in industry_pulse_signals.
// Flight risk taxonomy:
//   - "hard_to_poach"   → employer has 2+ recent expansion signals (candidate is comfortable)
//   - "high_flight_risk" → employer has zero recent signals (candidate likely receptive)
//   - "neutral"         → 1 signal, or no employer present
// Source protection: output uses generic phrasing ("Employer shows expansion signals") — never names Sonar, Industry Pulse, or any vendor.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const METRO_DETROIT = ["wayne", "oakland", "macomb", "detroit", "warren", "sterling heights", "troy", "livonia", "dearborn", "novi", "farmington", "southfield", "royal oak", "rochester", "pontiac", "auburn hills", "grosse pointe", "ferndale", "berkley", "madison heights", "canton", "westland", "taylor", "lincoln park"];

const GENERIC_EMAIL_PREFIXES = ["info@", "contact@", "admin@", "hello@", "support@", "office@", "mail@", "sales@"];

interface Candidate {
  id: string;
  full_name?: string | null;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  linkedin_url?: string | null;
  facebook_url?: string | null;
  current_employer?: string | null;
  license_type?: string | null;
  trade?: string | null;
  city?: string | null;
  years_experience?: number | null;
}

interface PulseSignal {
  id: string;
  company_name: string | null;
  signal_type: string | null;
  detected_at: string | null;
  confidence: number | null;
  hiring_count: number | null;
}

function classifyTrade(licenseType?: string | null): string | null {
  if (!licenseType) return null;
  const lt = licenseType.toLowerCase();
  if (lt.includes("boiler") || lt.includes("stationary")) return "boiler";
  if (lt.includes("hvac") || lt.includes("refrigeration") || lt.includes("mechanical")) return "hvac";
  if (lt.includes("plumb")) return "plumbing";
  if (lt.includes("electric")) return "electrical";
  if (lt.includes("nurse practitioner")) return "nurse_practitioner";
  if (lt.includes("nurse") || lt.includes("lpn") || lt.includes("rn") || lt.includes("cna")) return "nursing";
  if (lt.includes("home health") || lt.includes("aide")) return "home_health";
  if (lt.includes("weld")) return "welding";
  return "other_trade";
}

function scoreCandidate(c: Candidate): { score: number; reason: string } {
  let score = 1;
  const reasons: string[] = [];

  if (c.phone && c.phone.trim().length > 0) {
    score += 2; reasons.push("phone");
    const digits = c.phone.replace(/\D/g, "");
    if (digits.length === 10 || digits.length === 11) { score += 1; reasons.push("phone-valid"); }
  }
  if (c.email && c.email.includes("@")) {
    const isGeneric = GENERIC_EMAIL_PREFIXES.some((p) => c.email!.toLowerCase().startsWith(p));
    score += isGeneric ? 1 : 2;
    reasons.push(isGeneric ? "email-generic" : "email-personal");
  }
  if (c.linkedin_url || c.facebook_url) {
    score += 2; reasons.push(c.linkedin_url ? "linkedin" : "facebook");
  }
  if (c.current_employer && c.current_employer.trim().length > 0) {
    score += 1; reasons.push("employer");
  }
  if (c.license_type || c.trade) {
    score += 1; reasons.push("trade-known");
  }
  if (c.city) {
    const cityLower = c.city.toLowerCase();
    if (METRO_DETROIT.some((m) => cityLower.includes(m))) {
      score += 1; reasons.push("metro-detroit");
    }
  }
  if (c.years_experience && c.years_experience >= 3) {
    score += 1; reasons.push("experienced");
  }

  return { score: Math.min(10, Math.max(1, score)), reason: reasons.join(", ") };
}

/**
 * Cross-reference candidate's current_employer against industry_pulse_signals (last 60 days, confidence >= 6).
 * Returns flight_risk classification + 1-line proof string for dossier "Tangible Proof" section.
 * Uses generic phrasing — never names data sources.
 */
async function classifyFlightRisk(
  sb: ReturnType<typeof createClient>,
  employer: string | null | undefined
): Promise<{ flight_risk: string; flight_risk_proof: string }> {
  if (!employer || employer.trim().length < 2) {
    return { flight_risk: "neutral", flight_risk_proof: "Employer not identified — flight risk unknown." };
  }

  const sinceISO = new Date(Date.now() - 60 * 24 * 3600 * 1000).toISOString();
  const empNorm = employer.trim().replace(/[%_]/g, "").slice(0, 80);

  const { data: signals, error } = await sb
    .from("industry_pulse_signals")
    .select("id, company_name, signal_type, detected_at, confidence, hiring_count")
    .ilike("company_name", `%${empNorm}%`)
    .gte("detected_at", sinceISO)
    .gte("confidence", 6)
    .order("detected_at", { ascending: false })
    .limit(10);

  if (error) {
    return { flight_risk: "neutral", flight_risk_proof: "Employer activity check unavailable." };
  }

  const sigs = (signals as PulseSignal[]) || [];
  const count = sigs.length;
  const totalHiring = sigs.reduce((s, x) => s + (x.hiring_count || 0), 0);

  if (count >= 2) {
    const recent = sigs[0];
    const when = recent?.detected_at ? new Date(recent.detected_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "recently";
    const hiringNote = totalHiring > 0 ? ` (~${totalHiring} open roles tracked)` : "";
    return {
      flight_risk: "hard_to_poach",
      flight_risk_proof: `🛡️ HARD TO POACH — Current employer shows signs of stability and active growth. Candidate is likely comfortable in their role.`,
    };
  }

  if (count === 0) {
    return {
      flight_risk: "high_flight_risk",
      flight_risk_proof: `🎯 HIGH FLIGHT RISK — Current employer shows limited recent activity. Candidate may be more receptive to new opportunities.`,
    };
  }

  return {
    flight_risk: "neutral",
    flight_risk_proof: `↔️ NEUTRAL — Employer shows 1 recent activity signal. Approach with standard outreach.`,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    let candidateIds: string[] | undefined;
    if (req.method === "POST") {
      try {
        const body = await req.json();
        if (Array.isArray(body?.candidate_ids)) candidateIds = body.candidate_ids;
      } catch (_) { /* no body */ }
    }

    let query = sb
      .from("hire_alert_candidates")
      .select("id, full_name, name, phone, email, linkedin_url, facebook_url, current_employer, license_type, trade, city, years_experience")
      .limit(1000);

    if (candidateIds?.length) query = query.in("id", candidateIds);

    const { data: candidates, error } = await query;
    if (error) throw error;
    if (!candidates?.length) {
      return new Response(JSON.stringify({ message: "No candidates to score", scored: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let scored = 0;
    let highScore = 0;
    let tradesClassified = 0;
    let hardToPoach = 0;
    let highFlightRisk = 0;

    for (const c of candidates as Candidate[]) {
      const { score, reason } = scoreCandidate(c);
      const { flight_risk, flight_risk_proof } = await classifyFlightRisk(sb, c.current_employer);

      const reasonWithRisk = `${reason}, flight:${flight_risk}`;

      const updates: Record<string, unknown> = {
        score,
        availability_score: score,
        score_reason: reasonWithRisk,
        flight_risk,
        flight_risk_proof,
      };
      if (!c.trade && c.license_type) {
        const t = classifyTrade(c.license_type);
        if (t) { updates.trade = t; tradesClassified++; }
      }
      const { error: updErr } = await sb
        .from("hire_alert_candidates")
        .update(updates)
        .eq("id", c.id);
      if (!updErr) {
        scored++;
        if (score >= 7) highScore++;
        if (flight_risk === "hard_to_poach") hardToPoach++;
        if (flight_risk === "high_flight_risk") highFlightRisk++;
      }
    }

    await sb.from("agent_heartbeats").upsert({
      agent_name: "candidate-quality-scorer",
      last_beat: new Date().toISOString(),
      status: "ok",
      metadata: { scored, high_score: highScore, trades_classified: tradesClassified, hard_to_poach: hardToPoach, high_flight_risk: highFlightRisk },
    }, { onConflict: "agent_name" });

    return new Response(JSON.stringify({
      success: true,
      total: candidates.length,
      scored,
      high_score_7_plus: highScore,
      trades_classified: tradesClassified,
      flight_risk: { hard_to_poach: hardToPoach, high_flight_risk: highFlightRisk, neutral: scored - hardToPoach - highFlightRisk },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("candidate-quality-scorer error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
