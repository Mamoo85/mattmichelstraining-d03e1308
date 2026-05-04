import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { shouldAllowScale } from "./budget-gate.ts";
import { calcKpis } from "./kpi-math.ts";

Deno.test("budget-gate: under cap allows", () => {
  const r = shouldAllowScale({ spendToday: 2, capDaily: 10, costPerLead: 0.5 });
  assertEquals(r.allow, true);
  assertEquals(r.reason, "under_cap");
});

Deno.test("budget-gate: at cap blocks", () => {
  const r = shouldAllowScale({ spendToday: 10, capDaily: 10, costPerLead: 0.5 });
  assertEquals(r.allow, false);
  assertEquals(r.reason, "at_cap");
  assertEquals(r.remaining_usd, 0);
});

Deno.test("budget-gate: would exceed blocks", () => {
  const r = shouldAllowScale({ spendToday: 9.7, capDaily: 10, costPerLead: 0.5 });
  assertEquals(r.allow, false);
  assertEquals(r.reason, "would_exceed");
});

Deno.test("budget-gate: no cap allows", () => {
  const r = shouldAllowScale({ spendToday: 9999, capDaily: 0, costPerLead: 0.5 });
  assertEquals(r.allow, true);
  assertEquals(r.reason, "no_cap");
});

Deno.test("budget-gate: invalid input blocks", () => {
  const r = shouldAllowScale({ spendToday: -1, capDaily: 10, costPerLead: 0.5 });
  assertEquals(r.allow, false);
  assertEquals(r.reason, "invalid_input");
});

Deno.test("budget-gate: pct_used reported", () => {
  const r = shouldAllowScale({ spendToday: 7.5, capDaily: 10, costPerLead: 0.5 });
  assert(Math.abs(r.pct_used - 0.75) < 0.0001);
});

Deno.test("kpi-math: empty input returns zeros", () => {
  const r = calcKpis({ attempted: 0, enriched: 0, failed: 0, skipped: 0 });
  assertEquals(r.success_rate, 0);
  assertEquals(r.avg_ms_per_lead, 0);
});

Deno.test("kpi-math: mixed run computes rates", () => {
  const r = calcKpis({ attempted: 100, enriched: 60, failed: 30, skipped: 10, total_ms: 5000 });
  assertEquals(r.success_rate, 0.6);
  assertEquals(r.failure_rate, 0.3);
  assertEquals(r.skip_rate, 0.1);
  assertEquals(r.avg_ms_per_lead, 50);
});

Deno.test("kpi-math: negative input clamped to 0", () => {
  const r = calcKpis({ attempted: -5, enriched: -1, failed: 0, skipped: 0 });
  assertEquals(r.attempted, 0);
  assertEquals(r.enriched, 0);
  assertEquals(r.avg_ms_per_lead, 0);
});

Deno.test("kpi-math: all-success run", () => {
  const r = calcKpis({ attempted: 50, enriched: 50, failed: 0, skipped: 0, total_ms: 2500 });
  assertEquals(r.success_rate, 1);
  assertEquals(r.avg_ms_per_lead, 50);
});
