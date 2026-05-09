// Talent Ingest — normalize.ts
// Canonicalize incoming RawCandidate fields and flag junk rows before fingerprinting.

import type { RawCandidate } from "./types.ts";

export interface Normalized {
  name_normalized: string;
  phone_e164: string | null;
  email_normalized: string | null;
  domain_normalized: string | null;
  trade_canonical: string | null;
  state_upper: string | null;
  license_number_clean: string | null;
  confidence: number; // 0.0–1.0
  is_junk: boolean;
}

const TRADE_MAP: Record<string, string> = {
  hvac: "hvac", "heating and cooling": "hvac", boiler: "hvac",
  plumber: "plumbing", plumbing: "plumbing", pipefitter: "plumbing",
  electrician: "electrical", electrical: "electrical",
  cdl: "cdl_trucking", trucker: "cdl_trucking", driver: "cdl_trucking",
  cdl_trucking: "cdl_trucking", trucking: "cdl_trucking",
  rn: "nursing", nurse: "nursing", nursing: "nursing", lpn: "nursing",
  cna: "nursing", "home health": "nursing", home_health: "nursing",
  "registered nurse": "nursing", "licensed practical nurse": "nursing",
  "nurse practitioner": "nursing",
  welder: "welding", welding: "welding",
  machinist: "machining", machining: "machining",
};

// Junk names mirror migration 20260507 cleanup list — never let these into candidates.
const JUNK_NAMES = new Set<string>([
  "about us", "all menus", "business manager",
  "changing lives", "empowering workers", "keywords location",
  "local union", "main content", "main menu", "only customize",
  "pay dues", "union representatives", "worker apprentices",
  "worker journeyperson", "worker journeypersons", "about our",
]);

const NAME_SUFFIX_PATTERNS = [
  /\b(jr|sr|ii|iii|iv|v|esq|md|do|phd|rn|lpn|cna|cdl|p\.?e\.?)\b\.?$/i,
  /,$/,
];

function stripNameSuffixes(input: string): { cleaned: string; stripped: boolean } {
  let cleaned = input.trim();
  let stripped = false;
  for (let i = 0; i < 3; i++) {
    const before = cleaned;
    for (const pat of NAME_SUFFIX_PATTERNS) {
      cleaned = cleaned.replace(pat, "").trim().replace(/[,]+$/, "").trim();
    }
    if (cleaned === before) break;
    stripped = true;
  }
  return { cleaned, stripped };
}

export function normalizePhone(phone?: string | null): string | null {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  return null;
}

function normalizeEmail(email?: string | null): string | null {
  if (!email) return null;
  const e = String(email).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return null;
  return e;
}

function extractDomain(email: string | null, employer?: string | null): string | null {
  if (email) {
    const parts = email.split("@");
    if (parts.length === 2) return parts[1].toLowerCase();
  }
  if (employer) {
    const m = employer.match(/(?:https?:\/\/)?(?:www\.)?([a-z0-9-]+\.[a-z.]{2,})/i);
    if (m) return m[1].toLowerCase();
  }
  return null;
}

function canonicalTrade(trade?: string | null): string | null {
  if (!trade) return null;
  const t = trade.trim().toLowerCase();
  if (TRADE_MAP[t]) return TRADE_MAP[t];
  for (const [k, v] of Object.entries(TRADE_MAP)) {
    if (t.includes(k)) return v;
  }
  return t.replace(/\s+/g, "_");
}

function cleanLicense(num?: string | null): string | null {
  if (!num) return null;
  const cleaned = String(num).replace(/[^A-Za-z0-9-]/g, "").toUpperCase();
  return cleaned.length > 0 ? cleaned : null;
}

export function normalize(raw: RawCandidate): Normalized {
  let confidence = 1.0;

  // Name
  const rawName = (raw.full_name ?? "").trim();
  const { cleaned: nameNoSuffix, stripped } = stripNameSuffixes(rawName);
  const nameCollapsed = nameNoSuffix.replace(/[^\p{L}\p{N}\s'-]/gu, " ").replace(/\s+/g, " ").trim();
  const name_normalized = nameCollapsed.toLowerCase();
  if (stripped) confidence -= 0.1;
  if (name_normalized.length < rawName.length * 0.5) confidence -= 0.1;

  // Junk gate
  const is_junk =
    !name_normalized ||
    name_normalized.length < 3 ||
    JUNK_NAMES.has(name_normalized) ||
    /^[\s\d\W]+$/.test(name_normalized);

  // Phone
  const phone_e164 = normalizePhone(raw.phone);
  if (raw.phone && !phone_e164) confidence -= 0.15;

  // Email
  const email_normalized = normalizeEmail(raw.email);
  if (raw.email && !email_normalized) confidence -= 0.1;

  // Domain
  const domain_normalized = extractDomain(email_normalized, raw.current_employer);

  // Trade + state
  const trade_canonical = canonicalTrade(raw.trade);
  const state_upper = raw.state ? raw.state.trim().toUpperCase().slice(0, 2) || null : null;

  // License
  const license_number_clean = cleanLicense(raw.license_number);

  return {
    name_normalized,
    phone_e164,
    email_normalized,
    domain_normalized,
    trade_canonical,
    state_upper,
    license_number_clean,
    confidence: Math.max(0, Math.min(1, +confidence.toFixed(2))),
    is_junk,
  };
}
