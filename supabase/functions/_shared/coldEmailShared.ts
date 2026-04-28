// Shared utilities for the Cold Email Engine v3 (Demand Heat Sniper).
// Kept here so individual edge functions stay focused. Pure functions only —
// no DB or fetch calls — so anything imported here is unit-testable in isolation.

export const SUBJECT_ARMS = [
  "urgency",
  "name_drop_signal",
  "question",
  "permit_specific",
  "competitor_threat",
] as const;
export type SubjectArm = typeof SUBJECT_ARMS[number];

export const OPENER_ARMS = ["direct", "curious", "value"] as const;
export type OpenerArm = typeof OPENER_ARMS[number];

export const CTA_ARMS = ["free_dossier", "25", "50", "99"] as const;
export type CtaArm = typeof CTA_ARMS[number];

export interface BanditArmKey {
  subject: SubjectArm;
  opener: OpenerArm;
  cta: CtaArm;
}

export function armKey(k: BanditArmKey): string {
  return `subj:${k.subject}|open:${k.opener}|cta:${k.cta}`;
}

// Haversine distance in miles
export function haversineMiles(
  lat1: number, lng1: number, lat2: number, lng2: number,
): number {
  const R = 3958.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// 7-component Buyer Intent Score, max = 100, min = 0.
// All weights in plan: 25 + 15 + 10 - 20 + 15 + 15 + 20 = 80 positive + 20 deducted.
export interface BisInputs {
  vertical_fit: number;        // 0..1
  geo_score: number;           // 0..1 (1 = same city, 0 = >60mi)
  spend_window_match: number;  // 0..1
  recency_penalty: number;     // 0..1 (1 = contacted today, 0 = never)
  seniority: number;           // 0..1 (owner/buyer = 1, info@ = 0.1)
  deliverability: number;      // 0..1 (verified = 1, pattern guess = 0.5)
  past_lift: number;           // 0..1 (cohort historical reply rate, normalized)
}

export interface BisBreakdown {
  vertical: number;
  geo: number;
  spend_window: number;
  recency: number;
  seniority: number;
  deliverability: number;
  lift: number;
  total: number;
}

export function computeBis(i: BisInputs): BisBreakdown {
  const vertical       = round(25 * clamp01(i.vertical_fit));
  const geo            = round(15 * clamp01(i.geo_score));
  const spend_window   = round(10 * clamp01(i.spend_window_match));
  const recency        = -round(20 * clamp01(i.recency_penalty));
  const seniority      = round(15 * clamp01(i.seniority));
  const deliverability = round(15 * clamp01(i.deliverability));
  const lift           = round(20 * clamp01(i.past_lift));
  const total = Math.max(0, Math.min(100,
    vertical + geo + spend_window + recency + seniority + deliverability + lift));
  return { vertical, geo, spend_window, recency, seniority, deliverability, lift, total };
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}
function round(n: number): number { return Math.round(n * 10) / 10; }

// Static seniority weights — tuned for B2B branch supply
export function seniorityScore(title: string | null | undefined): number {
  if (!title) return 0.2;
  const t = title.toLowerCase();
  if (/owner|president|ceo/.test(t))               return 1.0;
  if (/purchasing|buyer|procurement/.test(t))      return 0.95;
  if (/branch (manager|mgr)|gm|general manager/.test(t)) return 0.9;
  if (/operations (manager|mgr)|ops/.test(t))      return 0.8;
  if (/sales (manager|mgr)|director/.test(t))      return 0.7;
  if (/manager|mgr|supervisor/.test(t))            return 0.6;
  return 0.4;
}

// Vertical fit: signal.predicted_needs ⋂ buyer.vertical
export function verticalFit(
  predicted_needs: string[] | null | undefined,
  buyer_vertical: string | null | undefined,
): number {
  if (!buyer_vertical) return 0.3;
  const v = buyer_vertical.toLowerCase();
  const needs = (predicted_needs || []).map((n) => n.toLowerCase());
  // strong synonyms map
  const map: Record<string, string[]> = {
    hvac: ["hvac", "ductwork", "boiler", "chiller", "rooftop unit", "rtu", "refrigerant", "sheet metal"],
    electrical: ["electrical", "wire", "conduit", "panel", "breaker", "switchgear", "transformer", "lighting"],
    plumbing: ["plumbing", "pipe", "fitting", "valve", "fixture", "drain", "water heater", "pex", "copper"],
    building_materials: ["lumber", "drywall", "insulation", "concrete", "steel stud", "framing", "roofing"],
    welding_cnc: ["weld", "consumable", "wire feed", "argon", "stick electrode", "cnc", "tooling", "machining"],
  };
  const synonyms = map[v] || [v];
  let hits = 0;
  for (const need of needs) {
    if (synonyms.some((s) => need.includes(s) || s.includes(need))) hits++;
  }
  if (needs.length === 0) return 0.4; // unknown needs → neutral
  return Math.min(1, 0.3 + 0.7 * (hits / needs.length));
}

// Recency penalty: 1.0 if contacted today, decays linearly to 0 at 30 days
export function recencyPenalty(last_outreach_at: string | null | undefined): number {
  if (!last_outreach_at) return 0;
  const ageDays = (Date.now() - new Date(last_outreach_at).getTime()) / 86_400_000;
  if (ageDays >= 30) return 0;
  return Math.max(0, 1 - ageDays / 30);
}

export function deliverabilityScore(
  email_source: string | null | undefined,
  email_verified: boolean | null | undefined,
  email_confidence: number | null | undefined,
): number {
  if (email_verified) return 1.0;
  const conf = (email_confidence ?? 0) / 100;
  switch ((email_source || "").toLowerCase()) {
    case "apollo":      return Math.max(0.8, conf);
    case "snov":        return Math.max(0.8, conf);
    case "hunter":      return Math.max(0.75, conf);
    case "pdl":         return Math.max(0.7, conf);
    case "site_scrape": return Math.max(0.6, conf);
    case "pattern":     return Math.max(0.4, conf);
    case "manual":      return 0.5;
    default:            return 0.3;
  }
}

// Local spam-score heuristic, 0 = clean, 10 = spammy
export function localSpamScore(subject: string, body: string): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;
  const text = `${subject}\n${body}`;
  // ALL CAPS words
  const capsWords = (text.match(/\b[A-Z]{4,}\b/g) || []).length;
  if (capsWords > 2) { score += 2; reasons.push(`${capsWords} ALL-CAPS words`); }
  // Excess exclamation
  const excl = (text.match(/!/g) || []).length;
  if (excl > 2) { score += 2; reasons.push(`${excl} exclamation marks`); }
  // Banned phrases
  const banned = ["click here", "act now", "limited time", "buy now", "100% free", "guarantee", "risk free", "viagra", "as seen on", "bitcoin"];
  for (const b of banned) {
    if (text.toLowerCase().includes(b)) { score += 2; reasons.push(`phrase "${b}"`); }
  }
  // Emoji density
  const emoji = (text.match(/[\u{1F300}-\u{1FAFF}]/gu) || []).length;
  if (emoji > 3) { score += 1; reasons.push(`${emoji} emojis`); }
  // $ signs in subject
  if ((subject.match(/\$/g) || []).length > 1) { score += 1; reasons.push("multiple $ in subject"); }
  // Subject length
  if (subject.length > 90) { score += 1; reasons.push(`subject ${subject.length} chars`); }
  // Link count
  const links = (body.match(/https?:\/\//g) || []).length;
  if (links > 3) { score += 1; reasons.push(`${links} links`); }
  return { score: Math.min(10, score), reasons };
}

// SHA-256 hash of a string for IP anonymization on share-page views
export async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Beta-distribution sample (Marsaglia & Tsang) for Thompson sampling
function gammaSample(shape: number): number {
  if (shape < 1) {
    return gammaSample(shape + 1) * Math.pow(Math.random(), 1 / shape);
  }
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  while (true) {
    let x = 0, v = 0;
    do {
      x = normalSample();
      v = 1 + c * x;
    } while (v <= 0);
    v = v * v * v;
    const u = Math.random();
    if (u < 1 - 0.0331 * x * x * x * x) return d * v;
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}
function normalSample(): number {
  // Box–Muller
  const u = 1 - Math.random(), v = 1 - Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
export function betaSample(alpha: number, beta: number): number {
  const x = gammaSample(alpha);
  const y = gammaSample(beta);
  return x / (x + y);
}

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Domain extraction from email or website
export function extractDomain(input: string | null | undefined): string | null {
  if (!input) return null;
  let s = input.trim().toLowerCase();
  if (s.includes("@")) s = s.split("@")[1];
  s = s.replace(/^https?:\/\//, "").replace(/^www\./, "");
  s = s.split("/")[0].split("?")[0];
  if (!s.includes(".")) return null;
  return s;
}
