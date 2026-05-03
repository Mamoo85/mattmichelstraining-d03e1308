// Tests for recency-decay.ts — pure exponential decay math.
// Run: deno test supabase/functions/_shared/recency-decay.test.ts
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { computeUrgencyScore, readinessWindow } from "./recency-decay.ts";

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

// ── computeUrgencyScore ──────────────────────────────────────────────────────

Deno.test("computeUrgencyScore: returns baseScore unchanged when firstSeenAt is null", () => {
  assertEquals(computeUrgencyScore(8, null), 8);
  assertEquals(computeUrgencyScore(0, null), 0);
});

Deno.test("computeUrgencyScore: returns baseScore unchanged for invalid date string", () => {
  assertEquals(computeUrgencyScore(7, "not-a-date"), 7);
  assertEquals(computeUrgencyScore(5, ""), 5);
});

Deno.test("computeUrgencyScore: score equals base when seen today (age ≈ 0)", () => {
  const score = computeUrgencyScore(10, new Date());
  // At day 0: e^0 = 1.0, so score ≈ 10
  assert(score >= 9.9 && score <= 10, `Expected ~10, got ${score}`);
});

Deno.test("computeUrgencyScore: decays to ~50% at half-life (14 days)", () => {
  const score = computeUrgencyScore(10, daysAgo(14));
  // e^(-14/14) = e^(-1) ≈ 0.368 — NOT 0.5 (this is continuous decay, not 50%)
  // At 14 days: 10 * e^(-1) ≈ 3.68
  assert(score >= 3.5 && score <= 3.8, `Expected ~3.68, got ${score}`);
});

Deno.test("computeUrgencyScore: score decreases as age increases", () => {
  const s1 = computeUrgencyScore(9, daysAgo(1));
  const s7 = computeUrgencyScore(9, daysAgo(7));
  const s30 = computeUrgencyScore(9, daysAgo(30));
  assert(s1 > s7, `day-1 (${s1}) should > day-7 (${s7})`);
  assert(s7 > s30, `day-7 (${s7}) should > day-30 (${s30})`);
});

Deno.test("computeUrgencyScore: accepts Date object", () => {
  const score = computeUrgencyScore(10, daysAgo(0));
  assert(score > 9, `Expected close to 10, got ${score}`);
});

Deno.test("computeUrgencyScore: returns baseScore for future date (daysSince < 0)", () => {
  const future = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
  assertEquals(computeUrgencyScore(6, future), 6);
});

Deno.test("computeUrgencyScore: result is rounded to 2 decimal places", () => {
  const score = computeUrgencyScore(10, daysAgo(3));
  const decimals = (score.toString().split(".")[1] ?? "").length;
  assert(decimals <= 2, `Expected ≤2 decimals, got ${decimals} in ${score}`);
});

// ── readinessWindow ──────────────────────────────────────────────────────────

Deno.test("readinessWindow: returns default window when firstSeenAt is null", () => {
  const w = readinessWindow(null);
  assertEquals(w, { from: 7, to: 21 });
});

Deno.test("readinessWindow: from is always less than to", () => {
  for (const days of [0, 1, 7, 14, 21, 30, 60]) {
    const w = readinessWindow(daysAgo(days));
    assert(w.from < w.to, `Expected from < to for ${days} days ago, got ${JSON.stringify(w)}`);
  }
});

Deno.test("readinessWindow: from >= 3 (minimum floor enforced)", () => {
  // Very old lead — from should not drop below 3
  const w = readinessWindow(daysAgo(60));
  assert(w.from >= 3, `Expected from >= 3, got ${w.from}`);
});

Deno.test("readinessWindow: to >= from + 5 (minimum spread enforced)", () => {
  for (const days of [0, 7, 14, 28]) {
    const w = readinessWindow(daysAgo(days));
    assert(w.to >= w.from + 5, `Expected to >= from+5, got ${JSON.stringify(w)}`);
  }
});

Deno.test("readinessWindow: window shrinks as lead ages", () => {
  const fresh = readinessWindow(daysAgo(0));
  const old = readinessWindow(daysAgo(20));
  // Both windows must be valid; the fresh one should have a larger 'to'
  assert(fresh.to >= old.to, `Fresh lead should have larger window: fresh=${JSON.stringify(fresh)}, old=${JSON.stringify(old)}`);
});

Deno.test("readinessWindow: accepts ISO string", () => {
  const w = readinessWindow(daysAgo(5).toISOString());
  assert(w.from >= 3 && w.to > w.from, `Unexpected window: ${JSON.stringify(w)}`);
});
