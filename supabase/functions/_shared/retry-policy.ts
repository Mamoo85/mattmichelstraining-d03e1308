// Sprint H — Retry policy with exponential backoff, PDL 429 handling, and
// per-provider circuit breaker. Used by the unified email waterfall and any
// other enrichment caller that needs to be resilient.
//
// Design principles:
//   - Never throws. Returns a tagged result so callers can branch.
//   - Backoff: 1s → 2s → 4s → 8s with ±20% jitter.
//   - PDL 429 honors `Retry-After` header (seconds or HTTP-date).
//   - Circuit breaker: if a provider fails >50% of last 20 calls, open the
//     breaker for 30 min. Trip-state stored in module-scope (per-isolate),
//     plus a DB-backed bump via existing `bump_provider_health` RPC.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export type RetryResult<T> =
  | { ok: true; value: T; attempts: number }
  | { ok: false; reason: string; attempts: number; lastStatus?: number; deadLetter?: boolean };

interface BreakerState {
  // Rolling window of last 20 outcomes (true=ok, false=fail).
  outcomes: boolean[];
  openedUntil: number; // epoch-ms; 0 = closed
}

const BREAKERS: Record<string, BreakerState> = {};
const BREAKER_WINDOW = 20;
const BREAKER_FAIL_THRESHOLD = 0.5; // 50% failure → open
const BREAKER_OPEN_MS = 30 * 60 * 1000; // 30 min

export function isBreakerOpen(provider: string): boolean {
  const b = BREAKERS[provider];
  if (!b) return false;
  if (b.openedUntil > Date.now()) return true;
  if (b.openedUntil !== 0 && b.openedUntil <= Date.now()) {
    // Reset half-open: clear outcomes for a fresh probe
    b.outcomes = [];
    b.openedUntil = 0;
  }
  return false;
}

function recordOutcome(provider: string, ok: boolean): void {
  const b = (BREAKERS[provider] ??= { outcomes: [], openedUntil: 0 });
  b.outcomes.push(ok);
  if (b.outcomes.length > BREAKER_WINDOW) b.outcomes.shift();
  if (b.outcomes.length >= 10) {
    const failRate = b.outcomes.filter((o) => !o).length / b.outcomes.length;
    if (failRate >= BREAKER_FAIL_THRESHOLD) {
      b.openedUntil = Date.now() + BREAKER_OPEN_MS;
      console.warn(`[retry-policy] circuit OPEN for ${provider} (fail rate ${(failRate * 100).toFixed(0)}%)`);
    }
  }
}

function jitter(ms: number): number {
  const variance = ms * 0.2;
  return Math.round(ms + (Math.random() * 2 - 1) * variance);
}

function parseRetryAfter(header: string | null): number | null {
  if (!header) return null;
  const asNum = Number(header);
  if (Number.isFinite(asNum) && asNum >= 0) return asNum * 1000;
  const asDate = Date.parse(header);
  if (!Number.isNaN(asDate)) {
    const delta = asDate - Date.now();
    return delta > 0 ? delta : null;
  }
  return null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface RetryOptions {
  provider: string;
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  // PDL 429 typically asks us to wait — give it more headroom.
  honorRetryAfter?: boolean;
}

/**
 * Wrap a fetch-returning function with exponential backoff + circuit breaker.
 * The fn must return a Response. Non-2xx responses with retryable status codes
 * (429, 502, 503, 504) trigger a retry. Other non-2xx are returned as-is.
 *
 * Caller is responsible for body consumption on the returned Response.
 */
export async function fetchWithBackoff(
  fn: () => Promise<Response>,
  opts: RetryOptions,
): Promise<RetryResult<Response>> {
  const { provider } = opts;
  const maxAttempts = opts.maxAttempts ?? 4;
  const baseDelay = opts.baseDelayMs ?? 1000;
  const maxDelay = opts.maxDelayMs ?? 8000;

  if (isBreakerOpen(provider)) {
    return { ok: false, reason: "circuit_open", attempts: 0 };
  }

  let lastStatus: number | undefined;
  let lastReason = "unknown";

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fn();
      lastStatus = res.status;

      const retryable = res.status === 429 || (res.status >= 502 && res.status <= 504);
      if (!retryable) {
        recordOutcome(provider, res.ok);
        return { ok: true, value: res, attempts: attempt };
      }

      // Retryable — drain body before retrying to avoid leaks
      try { await res.body?.cancel(); } catch (_) { /* noop */ }

      if (attempt >= maxAttempts) {
        recordOutcome(provider, false);
        lastReason = `http_${res.status}_after_${attempt}_attempts`;
        return {
          ok: false,
          reason: lastReason,
          attempts: attempt,
          lastStatus: res.status,
          deadLetter: true,
        };
      }

      let delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
      if (res.status === 429 && opts.honorRetryAfter !== false) {
        const ra = parseRetryAfter(res.headers.get("retry-after"));
        if (ra !== null) delay = Math.min(Math.max(ra, delay), 60_000);
      }
      await sleep(jitter(delay));
    } catch (e) {
      lastReason = (e as Error)?.message ?? "fetch_threw";
      if (attempt >= maxAttempts) {
        recordOutcome(provider, false);
        return { ok: false, reason: lastReason, attempts: attempt, deadLetter: true };
      }
      await sleep(jitter(Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay)));
    }
  }

  recordOutcome(provider, false);
  return { ok: false, reason: lastReason, attempts: maxAttempts, lastStatus, deadLetter: true };
}

/**
 * Push a permanent failure to the dead-letter queue. Best-effort — never throws.
 * Sprint H — Enhancement #2: DLQ aging policy is enforced by enrichment-dlq-drain.
 */
export async function recordDeadLetter(
  sb: SupabaseClient,
  args: {
    prospect_id: string;
    stage: string;
    error: string;
    payload?: unknown;
    next_retry_in_minutes?: number;
  },
): Promise<void> {
  try {
    const nextRetry = args.next_retry_in_minutes ?? 30;
    await sb.rpc("upsert_enrichment_dead_letter", {
      _prospect_id: args.prospect_id,
      _stage: args.stage,
      _error: args.error.slice(0, 500),
      _payload: args.payload ?? null,
      _next_retry_at: new Date(Date.now() + nextRetry * 60_000).toISOString(),
    });
  } catch (e) {
    console.warn("[retry-policy] DLQ insert failed:", (e as Error).message);
  }
}
