// Pure flight-risk scoring. Read-only — called by background rescorer, never live scanner.
// Items #5, #7, #14, #18 from the 50-item revenue ops list.

export interface CandidateFlightInputs {
  current_employer?: string | null;
  years_experience?: number | null;
  employer_count?: number | null;          // from PDL when present
  employer_headcount_delta?: number | null;
  employer_domain_breached_recently?: boolean | null;
  employer_negative_signals?: number;       // count from industry_pulse_signals
  employer_positive_signals?: number;
  employer_permit_dormant?: boolean;        // contractor employer with 0 permits 60d
  employer_whisard_violations?: number;     // wage/hour violations on record
  license_expiry?: string | null;           // ISO date
  personal_email_primary?: boolean;
}

export interface FlightRiskResult {
  level: "LOW" | "MEDIUM" | "HIGH";
  score: number;          // 0-10
  reasons: string[];
  job_stability_index: number | null;
}

export function computeFlightRisk(c: CandidateFlightInputs): FlightRiskResult {
  let score = 0;
  const reasons: string[] = [];

  // Employer signal cross-reference
  if ((c.employer_negative_signals ?? 0) > 0 && (c.employer_positive_signals ?? 0) === 0) {
    score += 3;
    reasons.push("Employer shows negative signals with zero growth momentum");
  }
  if ((c.employer_headcount_delta ?? 0) < -5) {
    score += 2;
    reasons.push(`Employer headcount declined ${Math.abs(c.employer_headcount_delta!)} in 30 days`);
  }
  if (c.employer_permit_dormant) {
    score += 2;
    reasons.push("Employer has pulled zero permits in 60+ days");
  }
  if (c.employer_domain_breached_recently) {
    score += 1;
    reasons.push("Employer domain involved in a recent data breach");
  }
  if ((c.employer_whisard_violations ?? 0) > 0) {
    score += 2;
    reasons.push("Employer has DOL wage/hour violations on record");
  }

  // License expiry within 90 days = motivated
  if (c.license_expiry) {
    const days = Math.round((new Date(c.license_expiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (days >= 0 && days <= 90) {
      score += 1;
      reasons.push(`License expires in ${days} days — renewal-motivated`);
    }
  }

  // Personal email primary = mentally separated from employer
  if (c.personal_email_primary) {
    score += 1;
    reasons.push("Uses personal email as primary contact");
  }

  // Job stability index
  let stability: number | null = null;
  if (c.years_experience && c.employer_count && c.employer_count > 0) {
    stability = Math.round((c.years_experience / c.employer_count) * 100) / 100;
    if (stability < 0.5) {
      score += 1;
      reasons.push(`Stability index ${stability} (serial job changer)`);
    }
  }

  score = Math.min(10, score);
  const level: FlightRiskResult["level"] = score >= 5 ? "HIGH" : score >= 3 ? "MEDIUM" : "LOW";
  return { level, score, reasons, job_stability_index: stability };
}

export function normalizeName(s: string | null | undefined): string {
  return (s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
