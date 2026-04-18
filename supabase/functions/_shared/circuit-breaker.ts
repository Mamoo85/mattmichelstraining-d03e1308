/**
 * Per-provider circuit breaker for enrichment APIs.
 * OPT-IN: nothing imports this yet — adopt it gradually inside the
 * enrichment waterfall to stop cascade failures (e.g. PDL 402 storms).
 *
 * Usage:
 *   import { withBreaker } from "../_shared/circuit-breaker.ts";
 *   const result = await withBreaker("pdl", () => fetchPdl(...));
 *   if (result.skipped) { ... breaker is open ... }
 */

type BreakerState = {
  failures: number;
  openedAt: number | null;
  lastFailureAt: number;
};

const FAILURE_THRESHOLD = 5;          // trip after 5 failures within window
const FAILURE_WINDOW_MS = 10 * 60_000;
const COOLDOWN_MS = 15 * 60_000;       // auto-reset after 15min
const states = new Map<string, BreakerState>();

function get(provider: string): BreakerState {
  const s = states.get(provider);
  if (s) return s;
  const fresh = { failures: 0, openedAt: null, lastFailureAt: 0 };
  states.set(provider, fresh);
  return fresh;
}

export interface BreakerResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
  skipped?: boolean;       // true when breaker was open and call was not attempted
  provider: string;
}

export async function withBreaker<T>(
  provider: string,
  fn: () => Promise<T>,
): Promise<BreakerResult<T>> {
  const state = get(provider);
  const now = Date.now();

  // Auto-reset after cooldown
  if (state.openedAt !== null && now - state.openedAt > COOLDOWN_MS) {
    state.openedAt = null;
    state.failures = 0;
  }

  // Trip is open — skip
  if (state.openedAt !== null) {
    return { ok: false, skipped: true, provider, error: "circuit_open" };
  }

  try {
    const data = await fn();
    // Success — half-open recovery: drain failure count
    if (state.failures > 0) state.failures = Math.max(0, state.failures - 1);
    return { ok: true, data, provider };
  } catch (e) {
    // Decay old failures outside the window
    if (now - state.lastFailureAt > FAILURE_WINDOW_MS) state.failures = 0;
    state.failures++;
    state.lastFailureAt = now;
    if (state.failures >= FAILURE_THRESHOLD) {
      state.openedAt = now;
    }
    return { ok: false, provider, error: e instanceof Error ? e.message : String(e) };
  }
}

export function breakerStatus() {
  const out: Record<string, { open: boolean; failures: number; openedAt: number | null }> = {};
  for (const [k, v] of states) {
    out[k] = { open: v.openedAt !== null, failures: v.failures, openedAt: v.openedAt };
  }
  return out;
}
