// Deduplication helpers — name + address normalization + fuzzy match.

const SUITE_RE = /\b(suite|ste|apt|unit|#)\s*\.?\s*[a-z0-9-]+/gi;
const STREET_ABBR: Record<string, string> = {
  street: "st", str: "st", avenue: "ave", av: "ave", boulevard: "blvd",
  road: "rd", drive: "dr", lane: "ln", court: "ct", place: "pl",
  circle: "cir", parkway: "pkwy", highway: "hwy", terrace: "ter",
  north: "n", south: "s", east: "e", west: "w",
  northeast: "ne", northwest: "nw", southeast: "se", southwest: "sw",
};
const BIZ_NOISE = /\b(llc|inc|incorporated|corp|corporation|co|company|ltd|limited|the|services?|group|sons?|brothers?|bros|holdings?)\b/gi;

export function normalizeAddress(addr: string | null | undefined): string {
  if (!addr) return "";
  let s = addr.toLowerCase().trim()
    .replace(SUITE_RE, "")
    .replace(/[.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  // Expand → abbreviate street suffixes
  s = s.split(" ").map(w => STREET_ABBR[w] ?? w).join(" ");
  return s.trim();
}

export function normalizeBizName(name: string | null | undefined): string {
  if (!name) return "";
  return name.toLowerCase()
    .replace(BIZ_NOISE, " ")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Levenshtein distance — returns 0..max(a,b). */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  let cur = new Array(n + 1).fill(0);
  for (let i = 1; i <= m; i++) {
    cur[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    [prev, cur] = [cur, prev];
  }
  return prev[n];
}

/** Returns a similarity 0..1 (1 = identical). */
export function similarity(a: string, b: string): number {
  const longer = a.length >= b.length ? a : b;
  if (longer.length === 0) return 1;
  return 1 - levenshtein(a, b) / longer.length;
}

/** Fuzzy match with default threshold of 0.85 — good for catching typos. */
export function fuzzyMatches(a: string, b: string, threshold = 0.85): boolean {
  return similarity(normalizeBizName(a), normalizeBizName(b)) >= threshold;
}

/** Stable dedup key for radar leads — name + zip-prefixed address hash. */
export function buildDedupeKey(name: string | null, address: string | null, zip?: string | null): string {
  const n = normalizeBizName(name || "");
  const a = normalizeAddress(address || "");
  const z = (zip || "").slice(0, 5);
  return `${n}|${a}|${z}`;
}
