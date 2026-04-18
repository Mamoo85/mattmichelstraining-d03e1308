// candidate-quality-scorer — scores hire_alert_candidates 1-10 based on contactability, trade fit, location.
// Trigger: cron daily 11:30 UTC OR manual POST { candidate_ids?: string[] }.
// Writes: hire_alert_candidates.score (existing column).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

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

  // Contact info (max 5)
  if (c.phone && c.phone.trim().length > 0) {
    score += 2;
    reasons.push("phone");
    const digits = c.phone.replace(/\D/g, "");
    if (digits.length === 10 || digits.length === 11) {
      score += 1;
      reasons.push("phone-valid");
    }
  }
  if (c.email && c.email.includes("@")) {
    const isGeneric = GENERIC_EMAIL_PREFIXES.some((p) => c.email!.toLowerCase().startsWith(p));
    score += isGeneric ? 1 : 2;
    reasons.push(isGeneric ? "email-generic" : "email-personal");
  }

  // Social proof (max 2)
  if (c.linkedin_url || c.facebook_url) {
    score += 2;
    reasons.push(c.linkedin_url ? "linkedin" : "facebook");
  }

  // Career signal (max 2)
  if (c.current_employer && c.current_employer.trim().length > 0) {
    score += 1;
    reasons.push("employer");
  }
  if (c.license_type || c.trade) {
    score += 1;
    reasons.push("trade-known");
  }

  // Location (max 1)
  if (c.city) {
    const cityLower = c.city.toLowerCase();
    if (METRO_DETROIT.some((m) => cityLower.includes(m))) {
      score += 1;
      reasons.push("metro-detroit");
    }
  }

  // Experience (max 1)
  if (c.years_experience && c.years_experience >= 3) {
    score += 1;
    reasons.push("experienced");
  }

  return {
    score: Math.min(10, Math.max(1, score)),
    reason: reasons.join(", "),
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

    if (candidateIds?.length) {
      query = query.in("id", candidateIds);
    }
    // No explicit "unscored only" filter — re-scoring is idempotent and cheap.

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

    for (const c of candidates as Candidate[]) {
      const { score, reason } = scoreCandidate(c);
      const updates: Record<string, unknown> = {
        score,
        availability_score: score,
        score_reason: reason,
      };
      // Backfill trade if missing
      if (!c.trade && c.license_type) {
        const t = classifyTrade(c.license_type);
        if (t) {
          updates.trade = t;
          tradesClassified++;
        }
      }
      const { error: updErr } = await sb
        .from("hire_alert_candidates")
        .update(updates)
        .eq("id", c.id);
      if (!updErr) {
        scored++;
        if (score >= 7) highScore++;
      }
    }

    // Heartbeat
    await sb.from("agent_heartbeats").upsert({
      agent_name: "candidate-quality-scorer",
      last_beat: new Date().toISOString(),
      status: "ok",
      metadata: { scored, high_score: highScore, trades_classified: tradesClassified },
    }, { onConflict: "agent_name" });

    return new Response(JSON.stringify({
      success: true,
      total: candidates.length,
      scored,
      high_score_7_plus: highScore,
      trades_classified: tradesClassified,
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
