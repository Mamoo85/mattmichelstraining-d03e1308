// Talent Ingest — score.ts
import type { RawCandidate } from "./types.ts";
import type { Normalized } from "./normalize.ts";

const SOURCE_WEIGHTS: Record<string, number> = {
  fmcsa_safer: 0.95,
  npi_registry: 0.95,
  miosha: 0.9,
  lara: 0.9,
  uspto: 0.85,
  sec_edgar: 0.85,
  sam_gov: 0.85,
  apollo: 0.6,
  hunter: 0.7,
  sonar: 0.55,
  firecrawl: 0.5,
  github: 0.6,
};

export function computeScore(raw: RawCandidate, n: Normalized): number {
  let base = 3;
  if (raw.observed_at) {
    const days = (Date.now() - new Date(raw.observed_at).getTime()) / 86400000;
    if (days < 7) base += 3;
    else if (days < 30) base += 2;
    else if (days < 90) base += 1;
  } else {
    base += 2;
  }
  if (n.phone_e164) base += 2;
  if (n.email_normalized) base += 1;
  if (raw.license_number) base += 1;
  base = Math.round(base * n.confidence);
  const weight = SOURCE_WEIGHTS[raw.source] ?? 0.5;
  return Math.max(1, Math.min(10, Math.round(base * weight + 2)));
}
