// Talent Ingest — fingerprint.ts
// Deterministic SHA-256 → 32-char hex fingerprint for dedupe.
// Priority: license > email > phone > name+trade+state.

import type { RawCandidate } from "./types.ts";
import type { Normalized } from "./normalize.ts";

export async function buildFingerprint(n: Normalized, raw: RawCandidate): Promise<string | null> {
  let key: string | null = null;
  if (n.license_number_clean && raw.license_type) {
    key = `lic|${raw.license_type.toLowerCase()}|${n.license_number_clean}`;
  } else if (n.email_normalized) {
    key = `email|${n.email_normalized}`;
  } else if (n.phone_e164) {
    key = `phone|${n.phone_e164}`;
  } else if (n.name_normalized && n.trade_canonical && n.state_upper) {
    key = `name|${n.name_normalized}|${n.trade_canonical}|${n.state_upper}`;
  }
  if (!key) return null;
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
}
