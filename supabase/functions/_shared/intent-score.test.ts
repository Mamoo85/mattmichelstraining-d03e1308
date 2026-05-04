// Tests for intent-score.ts — pure intent scoring math.
// Run: deno test supabase/functions/_shared/intent-score.test.ts
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { computeIntentScore, accountKey, type SignalRow, type WeightRow } from "./intent-score.ts";

const NOW = new Date("2026-05-04T12:00:00Z");

function signal(id: string, signal_type: string, daysBack: number): SignalRow {
  const d = new Date(NOW.getTime() - daysBack * 24 * 60 * 60 * 1000);
  return { id, signal_type, detected_at: d.toISOString() };
}

function weight(signal_type: string, w: number, half_life = 30, category = "general"): WeightRow {
  return { signal_type, weight: w, half_life_days: half_life, category };
}

// ── Empty / unknown signals ──────────────────────────────────────────────────

Deno.test("computeIntentScore: empty signals → score 0, tier cold", () => {
  const r = computeIntentScore([], [weight("job_post", 20)], NOW);
  assertEquals(r.score, 0);
  assertEquals(r.tier, "cold");
  assertEquals(r.signal_count, 0);
  assertEquals(r.stacking_multiplier, 1);
});

Deno.test("computeIntentScore: signal with no matching weight is skipped", () => {
  const r = computeIntentScore(
    [signal("s1", "unknown_type", 0)],
    [weight("job_post", 20)],
    NOW,
  );
  assertEquals(r.score, 0);
  assertEquals(r.signal_count, 0);
});

Deno.test("computeIntentScore: negligible decayed signals (< 0.5) are dropped", () => {
  // weight=1, half_life=1 day, age=100 days → 1 * 0.5^100 ≈ 0 (well below 0.5)
  const r = computeIntentScore(
    [signal("s1", "job_post", 100)],
    [weight("job_post", 1, 1)],
    NOW,
  );
  assertEquals(r.signal_count, 0);
});

// ── Score calculation and decay ──────────────────────────────────────────────

Deno.test("computeIntentScore: fresh signal at day 0 has full base weight", () => {
  // weight=30, age=0 → decay=0.5^0=1.0 → decayed=30
  const r = computeIntentScore(
    [signal("s1", "job_post", 0)],
    [weight("job_post", 30)],
    NOW,
  );
  // Score = 30 * 1.0 (no stacking, single category)
  assert(r.score >= 29.9 && r.score <= 30, `Expected ~30, got ${r.score}`);
  assertEquals(r.signal_count, 1);
});

Deno.test("computeIntentScore: score is capped at 100", () => {
  // Many heavy signals that would sum to >100
  const signals = Array.from({ length: 10 }, (_, i) => signal(`s${i}`, "job_post", 0));
  const r = computeIntentScore(signals, [weight("job_post", 50)], NOW);
  assert(r.score <= 100, `Score should be capped at 100, got ${r.score}`);
});

Deno.test("computeIntentScore: score is rounded to 2 decimal places", () => {
  const r = computeIntentScore(
    [signal("s1", "job_post", 3)],
    [weight("job_post", 20)],
    NOW,
  );
  const decimals = (r.score.toString().split(".")[1] ?? "").length;
  assert(decimals <= 2, `Expected ≤2 decimals, got ${r.score}`);
});

// ── Tier classification ──────────────────────────────────────────────────────

Deno.test("computeIntentScore: tier buying_now when score >= 90", () => {
  const r = computeIntentScore(
    [signal("s1", "job_post", 0)],
    [weight("job_post", 95)],
    NOW,
  );
  assertEquals(r.tier, "buying_now");
});

Deno.test("computeIntentScore: tier hot when score 70–89", () => {
  const r = computeIntentScore(
    [signal("s1", "job_post", 0)],
    [weight("job_post", 75)],
    NOW,
  );
  assertEquals(r.tier, "hot");
});

Deno.test("computeIntentScore: tier warming when score 50–69", () => {
  const r = computeIntentScore(
    [signal("s1", "job_post", 0)],
    [weight("job_post", 55)],
    NOW,
  );
  assertEquals(r.tier, "warming");
});

Deno.test("computeIntentScore: tier watching when score 30–49", () => {
  const r = computeIntentScore(
    [signal("s1", "job_post", 0)],
    [weight("job_post", 35)],
    NOW,
  );
  assertEquals(r.tier, "watching");
});

Deno.test("computeIntentScore: tier cold when score < 30", () => {
  const r = computeIntentScore(
    [signal("s1", "job_post", 0)],
    [weight("job_post", 10)],
    NOW,
  );
  assertEquals(r.tier, "cold");
});

// ── Stacking multiplier ──────────────────────────────────────────────────────

Deno.test("computeIntentScore: no stacking when < 3 categories within 30d", () => {
  const r = computeIntentScore(
    [signal("s1", "job_post", 0), signal("s2", "permit", 0)],
    [weight("job_post", 10, 30, "hiring"), weight("permit", 10, 30, "construction")],
    NOW,
  );
  assertEquals(r.stacking_multiplier, 1.0);
  assertEquals(r.category_count, 2);
});

Deno.test("computeIntentScore: stacking applies at 3 categories (1 + 0.15 × 3 = 1.45)", () => {
  const r = computeIntentScore(
    [signal("s1", "job_post", 0), signal("s2", "permit", 0), signal("s3", "funding", 0)],
    [
      weight("job_post", 10, 30, "hiring"),
      weight("permit", 10, 30, "construction"),
      weight("funding", 10, 30, "budget"),
    ],
    NOW,
  );
  assertEquals(r.stacking_multiplier, 1.45);
  assertEquals(r.category_count, 3);
});

Deno.test("computeIntentScore: stacking is capped at 1.75", () => {
  // 8 categories → 1 + 0.15*8 = 2.2 → capped at 1.75
  const signals = Array.from({ length: 8 }, (_, i) => signal(`s${i}`, `type_${i}`, 0));
  const weights = Array.from({ length: 8 }, (_, i) =>
    weight(`type_${i}`, 5, 30, `cat_${i}`)
  );
  const r = computeIntentScore(signals, weights, NOW);
  assertEquals(r.stacking_multiplier, 1.75);
});

Deno.test("computeIntentScore: old signals (>30d) do not contribute to stacking category count", () => {
  // 3 signals but all > 30 days old → no stacking
  const r = computeIntentScore(
    [signal("s1", "job_post", 35), signal("s2", "permit", 35), signal("s3", "funding", 35)],
    [
      weight("job_post", 20, 60, "hiring"),
      weight("permit", 20, 60, "construction"),
      weight("funding", 20, 60, "budget"),
    ],
    NOW,
  );
  assertEquals(r.stacking_multiplier, 1.0);
  assertEquals(r.category_count, 0);
});

// ── is_budget_released ───────────────────────────────────────────────────────

Deno.test("computeIntentScore: is_budget_released true when budget category signal is recent", () => {
  const r = computeIntentScore(
    [signal("s1", "funding", 5)],
    [weight("funding", 20, 30, "budget")],
    NOW,
  );
  assertEquals(r.is_budget_released, true);
});

Deno.test("computeIntentScore: is_budget_released false when no budget category", () => {
  const r = computeIntentScore(
    [signal("s1", "job_post", 5)],
    [weight("job_post", 20, 30, "hiring")],
    NOW,
  );
  assertEquals(r.is_budget_released, false);
});

// ── contributing_signals ordering ────────────────────────────────────────────

Deno.test("computeIntentScore: contributing_signals sorted by decayed_value descending", () => {
  const r = computeIntentScore(
    [signal("s1", "job_post", 20), signal("s2", "permit", 0)],
    [weight("job_post", 30, 30), weight("permit", 30, 30)],
    NOW,
  );
  assert(
    r.contributing_signals[0].decayed_value >= r.contributing_signals[1].decayed_value,
    "Expected descending decayed_value order",
  );
});

// ── accountKey ───────────────────────────────────────────────────────────────

Deno.test("accountKey: normalizes case and punctuation", () => {
  assertEquals(accountKey("Acme Corp.", "Detroit, MI"), accountKey("acme corp", "detroit mi"));
});

Deno.test("accountKey: handles null company and location", () => {
  const k = accountKey(null, null);
  assertEquals(k, "unknown|");
});

Deno.test("accountKey: different companies produce different keys", () => {
  assert(accountKey("Acme", "Detroit") !== accountKey("Beta", "Detroit"));
});

Deno.test("accountKey: different locations produce different keys", () => {
  assert(accountKey("Acme", "Detroit") !== accountKey("Acme", "Chicago"));
});
