// Scanner Source Framework
// =========================
// Reusable ingestion harness for every new scanner source. Wraps:
//   • fetchWithRetry        — exponential backoff + Retry-After honour
//   • circuit-breaker       — auto-trip on repeated failures
//   • token-bucket limiter  — per-host RPS cap (avoids upstream bans)
//   • canonical-mapper      — pushes normalized rows to canonical_* tables
//   • run logging           — writes to scanner_source_runs for /dwa-admin
//
// Author a new source in ~20 lines:
//
//   import { defineSource, runSource } from "../_shared/source-framework.ts";
//
//   export const myNewSource = defineSource({
//     slug: "wayne_sheriff_sales",
//     product: "mortgage_radar",
//     host: "waynecountysheriff.com",
//     rps: 1,
//     fetch: async (ctx) => {
//       const res = await ctx.fetch("https://waynecountysheriff.com/sales.json");
//       return res.json();
//     },
//     extractRows: (payload) => payload?.sales ?? [],
//   });
//
//   // From dispatcher / cron:
//   await runSource(sb, myNewSource);
//
// The framework guarantees:
//   - Retries on 429/5xx with backoff
//   - Per-host RPS limiting (shared across sources hitting the same host)
//   - Breaker auto-opens after 5 failures, auto-resets after 15min
//   - Every successful row is fanned into canonical_signals via canonical-mapper
//   - Errors never crash the dispatcher — they're logged and the source returns {ok:false}

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { fetchWithRetry } from "./fetch-with-retry.ts";
import { withBreaker } from "./circuit-breaker.ts";
import { persistCanonicalRows } from "./canonical-mapper.ts";

// ────────────────────────────────────────────────────────────────────────────
// Token-bucket per host (in-memory; resets on function cold start, that's OK)
// ────────────────────────────────────────────────────────────────────────────
type Bucket = { tokens: number; lastRefillMs: number; rps: number };
const buckets = new Map<string, Bucket>();

async function takeToken(host: string, rps: number): Promise<void> {
  let b = buckets.get(host);
  if (!b) {
    b = { tokens: rps, lastRefillMs: Date.now(), rps };
    buckets.set(host, b);
  }
  // Refill
  const now = Date.now();
  const elapsed = (now - b.lastRefillMs) / 1000;
  b.tokens = Math.min(b.rps, b.tokens + elapsed * b.rps);
  b.lastRefillMs = now;

  if (b.tokens >= 1) {
    b.tokens -= 1;
    return;
  }
  // Wait for next token
  const waitMs = Math.ceil(((1 - b.tokens) / b.rps) * 1000);
  await new Promise((r) => setTimeout(r, waitMs));
  b.tokens = 0;
  b.lastRefillMs = Date.now();
}

// ────────────────────────────────────────────────────────────────────────────
// Source contract
// ────────────────────────────────────────────────────────────────────────────
export interface SourceContext {
  /** RPS-aware, retry-aware fetch. Always use this — never bare fetch(). */
  fetch: (url: string, init?: RequestInit) => Promise<Response>;
  /** Source slug for log prefixes. */
  slug: string;
  /** Convenience JSON helper that returns null on parse failure. */
  fetchJson: <T = unknown>(url: string, init?: RequestInit) => Promise<T | null>;
}

export interface SourceDefinition<TPayload = unknown, TRow = Record<string, unknown>> {
  /** Stable identifier (used as `source` key in `scanner_source_mappings`). */
  slug: string;
  /** Target product (e.g. "mortgage_radar"). Used as fallback when no mapping row exists. */
  product: string;
  /** Host for per-host RPS limiting. Sources hitting the same host share a bucket. */
  host: string;
  /** Requests per second cap. Default 2. */
  rps?: number;
  /** Max retries per HTTP call. Default 3. */
  maxRetries?: number;
  /** Pull the upstream payload. Use ctx.fetch / ctx.fetchJson — never bare fetch(). */
  fetch: (ctx: SourceContext) => Promise<TPayload>;
  /** Pluck the row array from the payload. Default: assume payload is already an array. */
  extractRows?: (payload: TPayload) => TRow[];
  /** Optional pre-canonical row transform (rename / coerce fields). */
  normalize?: (row: TRow) => Record<string, unknown>;
  /** If true, skip canonical persistence (use for probe-only sources). Default false. */
  skipCanonical?: boolean;
}

export interface SourceRunResult {
  ok: boolean;
  slug: string;
  rows: number;
  durationMs: number;
  error?: string;
  skipped?: boolean; // breaker open
}

// ────────────────────────────────────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────────────────────────────────────
export function defineSource<P = unknown, R = Record<string, unknown>>(
  def: SourceDefinition<P, R>,
): SourceDefinition<P, R> {
  if (!def.slug || !def.product || !def.host || !def.fetch) {
    throw new Error(`defineSource: slug, product, host, fetch are required`);
  }
  return def;
}

export async function runSource<P, R>(
  sb: SupabaseClient,
  def: SourceDefinition<P, R>,
): Promise<SourceRunResult> {
  const start = Date.now();
  const rps = def.rps ?? 2;
  const maxRetries = def.maxRetries ?? 3;
  const label = `source:${def.slug}`;

  const ctx: SourceContext = {
    slug: def.slug,
    fetch: async (url, init) => {
      await takeToken(def.host, rps);
      return fetchWithRetry(url, init ?? {}, { label, maxRetries });
    },
    fetchJson: async <T,>(url: string, init?: RequestInit) => {
      try {
        await takeToken(def.host, rps);
        const res = await fetchWithRetry(url, init ?? {}, { label, maxRetries });
        if (!res.ok) {
          console.warn(`[${label}] HTTP ${res.status} for ${url}`);
          return null;
        }
        return (await res.json()) as T;
      } catch (e) {
        console.warn(`[${label}] fetchJson error:`, (e as Error).message);
        return null;
      }
    },
  };

  const breakerResult = await withBreaker(def.slug, async () => {
    const payload = await def.fetch(ctx);
    const rawRows = def.extractRows
      ? def.extractRows(payload)
      : (Array.isArray(payload) ? (payload as unknown as R[]) : []);
    const rows = def.normalize ? rawRows.map(def.normalize) : (rawRows as Record<string, unknown>[]);
    return rows;
  });

  if (breakerResult.skipped) {
    await logRun(sb, {
      source: def.slug,
      product: def.product,
      ok: false,
      rows: 0,
      duration_ms: Date.now() - start,
      error: "breaker_open",
    });
    return { ok: false, slug: def.slug, rows: 0, durationMs: Date.now() - start, skipped: true };
  }

  if (!breakerResult.ok) {
    await logRun(sb, {
      source: def.slug,
      product: def.product,
      ok: false,
      rows: 0,
      duration_ms: Date.now() - start,
      error: breakerResult.error ?? "unknown_error",
    });
    return {
      ok: false,
      slug: def.slug,
      rows: 0,
      durationMs: Date.now() - start,
      error: breakerResult.error,
    };
  }

  const rows = breakerResult.data ?? [];

  if (rows.length > 0 && !def.skipCanonical) {
    try {
      await persistCanonicalRows(sb, {
        source: def.slug,
        product: def.product,
        rows,
      });
    } catch (e) {
      console.warn(`[${label}] canonical persist failed:`, (e as Error).message);
    }
  }

  const durationMs = Date.now() - start;
  await logRun(sb, {
    source: def.slug,
    product: def.product,
    ok: true,
    rows: rows.length,
    duration_ms: durationMs,
  });

  return { ok: true, slug: def.slug, rows: rows.length, durationMs };
}

/** Run many sources in parallel with bounded concurrency. */
export async function runSources(
  sb: SupabaseClient,
  defs: SourceDefinition[],
  opts: { concurrency?: number } = {},
): Promise<SourceRunResult[]> {
  const concurrency = opts.concurrency ?? 5;
  const results: SourceRunResult[] = [];
  let i = 0;
  async function worker() {
    while (i < defs.length) {
      const idx = i++;
      results[idx] = await runSource(sb, defs[idx]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, defs.length) }, worker));
  return results;
}

// ────────────────────────────────────────────────────────────────────────────
// Run logging (best-effort — never throws)
// ────────────────────────────────────────────────────────────────────────────
async function logRun(
  sb: SupabaseClient,
  row: {
    source: string;
    product: string;
    ok: boolean;
    rows: number;
    duration_ms: number;
    error?: string;
  },
): Promise<void> {
  try {
    await sb.from("scanner_source_runs").insert({
      source: row.source,
      product: row.product,
      ok: row.ok,
      rows_returned: row.rows,
      duration_ms: row.duration_ms,
      error: row.error ?? null,
      ran_at: new Date().toISOString(),
    });
  } catch {
    // Table may not exist yet — fail silent (framework still works without logging table).
  }
}
