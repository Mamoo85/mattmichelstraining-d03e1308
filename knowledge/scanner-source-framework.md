# Scanner Ingestion Framework

A reusable harness for adding new scanner sources with shared retry, rate-limiting, circuit breaking, and canonical normalization. Located at `supabase/functions/_shared/source-framework.ts`.

## Why

Before the framework, every new source duplicated:
- `try/catch` around `fetch()`
- Backoff on 429
- Inline JSON parsing
- Ad-hoc upsert into product-specific tables

That meant ~80 lines of plumbing per source, and inconsistent behavior across the 200+ sources. The framework collapses all of that to ~15 lines per source and guarantees identical resilience semantics.

## Authoring a source

```ts
import { defineSource } from "../_shared/source-framework.ts";

export const waynesheriff = defineSource({
  slug: "wayne_sheriff_sales",       // stable id (used in scanner_source_mappings)
  product: "mortgage_radar",          // default target product
  host: "waynecountysheriff.com",     // for per-host RPS bucket
  rps: 1,                             // requests per second cap (default 2)
  fetch: async (ctx) => {
    return await ctx.fetchJson("https://waynecountysheriff.com/sales.json");
  },
  extractRows: (payload) => payload?.sales ?? [],
  normalize: (row) => ({              // optional pre-canonical transform
    external_id: row.case_no,
    address: row.property_address,
    occurred_at: row.sale_date,
    estimated_value: row.judgment_amount,
  }),
});
```

## Running sources

```ts
import { runSource, runSources } from "../_shared/source-framework.ts";

// Single source
const result = await runSource(sb, waynesheriff);

// Many sources in parallel (default concurrency: 5)
const results = await runSources(sb, [src1, src2, src3, ...], { concurrency: 5 });
```

Result shape:
```ts
{ ok: boolean, slug: string, rows: number, durationMs: number, error?: string, skipped?: boolean }
```

## What the framework gives you for free

| Concern | Implementation |
|---|---|
| HTTP 429 / Retry-After | `fetchWithRetry` exponential backoff (3 attempts, cap 30s) |
| Repeated upstream failure | `withBreaker` — auto-opens after 5 fails / 10min, resets after 15min cooldown |
| Per-host rate limiting | Token-bucket per `host`; sources sharing a host share a bucket |
| Canonical fan-out | `persistCanonicalRows` writes to `canonical_events` + `canonical_signals` honoring `scanner_source_mappings` |
| Error containment | Thrown errors caught and returned as `{ok: false, error}` — never crashes the dispatcher |
| Run telemetry | Every run logs to `scanner_source_runs` (source, product, ok, rows, duration, error) |
| Type safety | Full generics on `SourceDefinition<P, R>` for payload + row types |

## Context API (passed to your `fetch`)

```ts
ctx.fetch(url, init?)         // RPS-aware + retry-aware fetch
ctx.fetchJson<T>(url, init?)  // Same + auto JSON parse, returns null on failure
ctx.slug                       // your source slug, for logging
```

**Always use `ctx.fetch`** — never bare `fetch()`. Bare fetch bypasses the rate limiter and retry logic.

## Canonical mapping

After `fetch` + `extractRows` + `normalize` (optional), the framework calls `persistCanonicalRows(sb, { source, product, rows })`. That helper:

1. Looks up `scanner_source_mappings` for `source = slug` (explicit field map wins).
2. Falls back to category-template heuristic from `inferCategory(slug)` if no row exists.
3. Writes `canonical_events` + fans out to `canonical_signals` per `target_products`.

Set `skipCanonical: true` on a `defineSource` call for probe-only sources (e.g. health checks that just verify the endpoint is alive).

## Telemetry table

`public.scanner_source_runs` — one row per run, indexed by `(source, ran_at DESC)` and `(product, ran_at DESC)`. Use this to power per-source uptime + last-success-at widgets on `/dwa-admin/scanner-sources`.

```sql
-- last 24h success rate per source
SELECT source,
       COUNT(*)                   AS runs,
       AVG(CASE WHEN ok THEN 1 ELSE 0 END)::numeric(4,3) AS success_rate,
       MAX(ran_at)                AS last_run,
       SUM(rows_returned)         AS rows_24h
FROM scanner_source_runs
WHERE ran_at > now() - interval '24 hours'
GROUP BY source
ORDER BY success_rate ASC, last_run DESC;
```

## Migration path for existing scanners

The 200 sources already live in `_shared/scanner-extras-2026-{a..e}.ts` continue to work unchanged via the existing dispatcher. New sources should be authored against the framework. Over time, existing sources can be wrapped one at a time — `defineSource` is purely additive.

## Files

- `supabase/functions/_shared/source-framework.ts` — framework itself
- `supabase/functions/_shared/source-framework.example.ts` — two reference sources
- `supabase/functions/_shared/source-framework.test.ts` — 4 unit tests (all passing)
- `supabase/migrations/*_scanner_source_runs.sql` — telemetry table
