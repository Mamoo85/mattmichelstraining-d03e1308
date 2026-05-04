// Tests for permit-velocity.ts — pure permit velocity scoring.
// Run: deno test supabase/functions/_shared/permit-velocity.test.ts
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { computeVelocity, type PermitRecord } from "./permit-velocity.ts";

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();
}

function permit(daysBack: number, overrides: Partial<PermitRecord> = {}): PermitRecord {
  return {
    contractor_name: "Test Co",
    permit_value: 10_000,
    permit_type: "roofing",
    issued_at: daysAgo(daysBack),
    ...overrides,
  };
}

// ── Empty input ──────────────────────────────────────────────────────────────

Deno.test("computeVelocity: returns zero result for empty permit list", () => {
  const r = computeVelocity([]);
  assertEquals(r.permits_30d, 0);
  assertEquals(r.permits_60d, 0);
  assertEquals(r.permits_90d, 0);
  assertEquals(r.avg_permit_value, 0);
  assertEquals(r.permit_velocity_score, 0);
  assertEquals(r.growth_trajectory, "unknown");
  assertEquals(r.contractor_status, "unknown");
  assertEquals(r.last_permit_at, null);
});

// ── Window counts ────────────────────────────────────────────────────────────

Deno.test("computeVelocity: correctly buckets permits into 30/60/90 day windows", () => {
  const permits = [
    permit(10),  // within 30d
    permit(25),  // within 30d
    permit(45),  // within 60d only
    permit(75),  // within 90d only
    permit(100), // outside all windows
  ];
  const r = computeVelocity(permits);
  assertEquals(r.permits_30d, 2);
  assertEquals(r.permits_60d, 3);
  assertEquals(r.permits_90d, 4);
});

Deno.test("computeVelocity: permits_60d >= permits_30d >= 0 always", () => {
  const r = computeVelocity([permit(5), permit(35), permit(65)]);
  assert(r.permits_60d >= r.permits_30d);
  assert(r.permits_90d >= r.permits_60d);
});

// ── Avg permit value ─────────────────────────────────────────────────────────

Deno.test("computeVelocity: avg_permit_value computed over 90d window only", () => {
  const permits = [
    permit(10, { permit_value: 20_000 }),
    permit(50, { permit_value: 10_000 }),
    permit(100, { permit_value: 999_999 }), // outside 90d — excluded
  ];
  const r = computeVelocity(permits);
  // avg of 20000 + 10000 = 15000
  assertEquals(r.avg_permit_value, 15_000);
});

Deno.test("computeVelocity: null permit_value treated as 0 in average", () => {
  const permits = [
    permit(5, { permit_value: null }),
    permit(10, { permit_value: 10_000 }),
  ];
  const r = computeVelocity(permits);
  assertEquals(r.avg_permit_value, 5_000);
});

// ── Velocity score ───────────────────────────────────────────────────────────

Deno.test("computeVelocity: velocity score = permits_30d × (avg_value / 10000)", () => {
  // 2 permits in 30d, avg $20k → score = 2 * (20000/10000) = 4.0
  const permits = [
    permit(5, { permit_value: 20_000 }),
    permit(15, { permit_value: 20_000 }),
  ];
  const r = computeVelocity(permits);
  assertEquals(r.permit_velocity_score, 4.0);
});

Deno.test("computeVelocity: velocity score is 0 when no 30d permits", () => {
  const r = computeVelocity([permit(45), permit(75)]);
  assertEquals(r.permit_velocity_score, 0);
});

// ── Growth trajectory ────────────────────────────────────────────────────────

Deno.test("computeVelocity: emerging_volume_buyer when 30d count > 1.4× prior 30d with ≥3 permits", () => {
  // 5 permits in last 30d, 1 in 31-60d window → ratio 5:1 > 1.4, count ≥ 3
  const permits = [
    permit(5), permit(10), permit(15), permit(20), permit(25), // 5 in 30d
    permit(45), // 1 in prior 30d
  ];
  const r = computeVelocity(permits);
  assertEquals(r.growth_trajectory, "emerging_volume_buyer");
});

Deno.test("computeVelocity: declining when 30d count < 50% of prior 30d", () => {
  // 1 permit in 30d, 5 in 31-60d → ratio 1:5 < 0.5
  const permits = [
    permit(5), // 1 in 30d
    permit(35), permit(40), permit(45), permit(50), permit(55), // 5 in prior 30d
  ];
  const r = computeVelocity(permits);
  assertEquals(r.growth_trajectory, "declining");
});

Deno.test("computeVelocity: stable when change is moderate", () => {
  // 2 in 30d, 3 in prior 30d — ratio 2:3, neither > 1.4 nor < 0.5
  const permits = [permit(5), permit(15), permit(35), permit(45), permit(55)];
  const r = computeVelocity(permits);
  assertEquals(r.growth_trajectory, "stable");
});

// ── Contractor status ────────────────────────────────────────────────────────

Deno.test("computeVelocity: new when all 90d permits are within 30d and count ≤ 2", () => {
  const permits = [permit(5), permit(12)];
  const r = computeVelocity(permits);
  assertEquals(r.contractor_status, "new");
});

Deno.test("computeVelocity: active when last permit is recent", () => {
  const permits = [permit(5), permit(30), permit(60)];
  const r = computeVelocity(permits);
  assertEquals(r.contractor_status, "active");
});

// ── Trade mix ────────────────────────────────────────────────────────────────

Deno.test("computeVelocity: trade_mix counts permit types within 90d", () => {
  const permits = [
    permit(5, { permit_type: "roofing" }),
    permit(10, { permit_type: "roofing" }),
    permit(20, { permit_type: "hvac" }),
    permit(100, { permit_type: "plumbing" }), // outside 90d
  ];
  const r = computeVelocity(permits);
  assertEquals(r.trade_mix["roofing"], 2);
  assertEquals(r.trade_mix["hvac"], 1);
  assertEquals(r.trade_mix["plumbing"], undefined);
});

Deno.test("computeVelocity: null permit_type recorded as 'unknown' in trade_mix", () => {
  const r = computeVelocity([permit(5, { permit_type: null })]);
  assertEquals(r.trade_mix["unknown"], 1);
});

// ── last_permit_at ───────────────────────────────────────────────────────────

Deno.test("computeVelocity: last_permit_at is the most recent permit date", () => {
  const recent = daysAgo(2);
  const old = daysAgo(50);
  const r = computeVelocity([
    { contractor_name: "Co", issued_at: old },
    { contractor_name: "Co", issued_at: recent },
  ]);
  // Should pick the most recent
  const diff = Math.abs(r.last_permit_at!.getTime() - new Date(recent).getTime());
  assert(diff < 1000, `Expected last_permit_at ≈ ${recent}, got ${r.last_permit_at}`);
});
