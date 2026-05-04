// Tests for circuit-breaker.ts — per-provider circuit breaker state machine.
// Run: deno test supabase/functions/_shared/circuit-breaker.test.ts
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { withBreaker, breakerStatus } from "./circuit-breaker.ts";

// Each test uses a unique provider name so in-memory state doesn't bleed between tests.
let providerSeq = 0;
function uniqueProvider(): string {
  return `test_provider_${++providerSeq}`;
}

// ── Happy path ───────────────────────────────────────────────────────────────

Deno.test("withBreaker: passes through successful call result", async () => {
  const p = uniqueProvider();
  const result = await withBreaker(p, async () => "hello");
  assertEquals(result.ok, true);
  assertEquals(result.data, "hello");
  assertEquals(result.provider, p);
  assertEquals(result.skipped, undefined);
});

Deno.test("withBreaker: returns error on thrown exception, ok=false", async () => {
  const p = uniqueProvider();
  const result = await withBreaker(p, async () => { throw new Error("boom"); });
  assertEquals(result.ok, false);
  assertEquals(result.error, "boom");
  assertEquals(result.provider, p);
});

// ── Failure counting and trip ────────────────────────────────────────────────

Deno.test("withBreaker: does not trip before 5 failures", async () => {
  const p = uniqueProvider();
  for (let i = 0; i < 4; i++) {
    await withBreaker(p, async () => { throw new Error("fail"); });
  }
  // 5th call should still execute (not skipped)
  let executed = false;
  await withBreaker(p, async () => { executed = true; throw new Error("fail"); });
  assert(executed, "Expected 5th call to execute before trip");
});

Deno.test("withBreaker: trips open after 5 failures, subsequent calls are skipped", async () => {
  const p = uniqueProvider();
  for (let i = 0; i < 5; i++) {
    await withBreaker(p, async () => { throw new Error("fail"); });
  }
  const result = await withBreaker(p, async () => "should not run");
  assertEquals(result.ok, false);
  assertEquals(result.skipped, true);
  assertEquals(result.error, "circuit_open");
});

Deno.test("withBreaker: skipped call does not execute the function", async () => {
  const p = uniqueProvider();
  for (let i = 0; i < 5; i++) {
    await withBreaker(p, async () => { throw new Error("fail"); });
  }
  let ran = false;
  await withBreaker(p, async () => { ran = true; return "x"; });
  assert(!ran, "Function should not have executed when circuit is open");
});

// ── Success drains failure count ─────────────────────────────────────────────

Deno.test("withBreaker: success after failures drains failure count by 1", async () => {
  const p = uniqueProvider();
  // Cause 3 failures
  for (let i = 0; i < 3; i++) {
    await withBreaker(p, async () => { throw new Error("fail"); });
  }
  // One success
  await withBreaker(p, async () => "ok");
  // Status should show failures = 2 (drained from 3)
  const status = breakerStatus();
  assertEquals(status[p].failures, 2);
  assertEquals(status[p].open, false);
});

// ── breakerStatus ────────────────────────────────────────────────────────────

Deno.test("breakerStatus: returns open=false for fresh provider", async () => {
  const p = uniqueProvider();
  await withBreaker(p, async () => "ok");
  const status = breakerStatus();
  assert(p in status);
  assertEquals(status[p].open, false);
  assertEquals(status[p].failures, 0);
});

Deno.test("breakerStatus: reflects open state after trip", async () => {
  const p = uniqueProvider();
  for (let i = 0; i < 5; i++) {
    await withBreaker(p, async () => { throw new Error("fail"); });
  }
  const status = breakerStatus();
  assertEquals(status[p].open, true);
  assert(status[p].openedAt !== null);
});

// ── Non-Error throws ─────────────────────────────────────────────────────────

Deno.test("withBreaker: handles non-Error throws (string, number)", async () => {
  const p1 = uniqueProvider();
  const r1 = await withBreaker(p1, async () => { throw "string error"; });
  assertEquals(r1.ok, false);
  assertEquals(r1.error, "string error");

  const p2 = uniqueProvider();
  const r2 = await withBreaker(p2, async () => { throw 42; });
  assertEquals(r2.ok, false);
  assertEquals(r2.error, "42");
});

// ── Multiple providers are isolated ──────────────────────────────────────────

Deno.test("withBreaker: tripping one provider does not affect another", async () => {
  const p1 = uniqueProvider();
  const p2 = uniqueProvider();

  for (let i = 0; i < 5; i++) {
    await withBreaker(p1, async () => { throw new Error("fail"); });
  }

  // p2 should still execute normally
  const result = await withBreaker(p2, async () => "works");
  assertEquals(result.ok, true);
  assertEquals(result.data, "works");
});
