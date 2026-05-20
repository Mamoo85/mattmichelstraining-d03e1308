// Deterministic PRNG so mock data is stable across renders.
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seedFromString(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function seededReviews(productId: string) {
  const rng = mulberry32(seedFromString(productId));
  const count = Math.floor(rng() * 800) + 40;
  const fiveStarPct = 0.55 + rng() * 0.4;
  const fourStarPct = (1 - fiveStarPct) * (0.5 + rng() * 0.3);
  const remaining = 1 - fiveStarPct - fourStarPct;
  const buckets = {
    5: Math.round(count * fiveStarPct),
    4: Math.round(count * fourStarPct),
    3: Math.round(count * remaining * 0.6),
    2: Math.round(count * remaining * 0.25),
    1: Math.round(count * remaining * 0.15),
  };
  const total = Object.values(buckets).reduce((a, b) => a + b, 0);
  const avg = (5 * buckets[5] + 4 * buckets[4] + 3 * buckets[3] + 2 * buckets[2] + 1 * buckets[1]) / total;
  return { count: total, buckets, avg };
}

export function seededSalesVelocity(productId: string) {
  const rng = mulberry32(seedFromString(productId + ":vel"));
  return Math.floor(rng() * 90) + 3; // 3-92 units sold
}
