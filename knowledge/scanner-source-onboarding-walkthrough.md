# Adding a New Scanner Source — End-to-End Walkthrough

This is the canonical, step-by-step guide for adding a new scanner source on top of the
reusable ingestion framework (`supabase/functions/_shared/source-framework.ts`). It uses
the live ATTOM Property API integration (`scanner-sources-batch-2.ts`) as the worked example.

Time-to-ship for a typical source: **15–30 minutes**.

---

## Step 0 — Decide what the source is

Answer these four questions before touching code:

| Question | Example (ATTOM) |
|---|---|
| What **product** consumes the rows? | `mortgage_radar` |
| What **host** does it hit? (used for the RPS bucket) | `api.gateway.attomdata.com` |
| What's the **auth model**? (none / api key / OAuth) | API key in `apikey` header → secret `ATTOM_API_KEY` |
| What's the **canonical entity type**? (event / company / person / place) | `event` (property snapshot per address) |

Add the source to `knowledge/scanner-source-backlog-next-20.md` if it's not already listed.

---

## Step 1 — Add the API key as a secret (skip if no auth)

If the source requires an API key, request it from the user via the Lovable secrets UI.
**Never hard-code keys** and **never read keys at module scope** — read inside the
`fetch()` closure so the function can still load when the key is absent (the framework
classifies the resulting throw as `AUTH` and moves on).

```ts
function requireKey(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`AUTH: ${name} not configured (no api key)`);
  return v;
}
```

---

## Step 2 — Author the source with `defineSource()`

Drop the source into the relevant batch file under `supabase/functions/_shared/`
(create a new `scanner-sources-batch-N.ts` if a logical grouping doesn't exist):

```ts
// supabase/functions/_shared/scanner-sources-batch-2.ts
import { defineSource } from "./source-framework.ts";

export const attomPropertySnapshot = defineSource({
  slug:    "attom_property_snapshot",  // stable id; appears in scanner_source_mappings + scanner_source_runs
  product: "mortgage_radar",            // default target product
  host:    "api.gateway.attomdata.com",
  rps:     1,                           // be conservative; framework auto-paces

  fetch: async (ctx) => {
    const key = requireKey("ATTOM_API_KEY");
    const zip = getRotatingZip();       // rotate inputs across runs (see Step 4)
    const url = `https://api.gateway.attomdata.com/propertyapi/v1.0.0/property/snapshot?postalcode=${zip}&pagesize=100`;
    return await ctx.fetchJson(url, {
      headers: { apikey: key, Accept: "application/json" },
    });
  },

  extractRows: (payload) => (payload?.property ?? []) as Record<string, unknown>[],

  normalize: (row) => {
    const r = row as Record<string, any>;
    const a = r.address ?? {};
    return {
      external_id:     r.identifier?.attomId,
      address:         a.line1,
      city:            a.locality,
      state:           a.countrySubd,
      zip:             a.postal1,
      county:          a.countrySecSubd,
      lat:             r.location?.latitude,
      lon:             r.location?.longitude,
      occurred_at:     r.sale?.saleSearchDate,
      estimated_value: r.avm?.amount?.value,
      title:           "ATTOM property snapshot",
    };
  },
});
```

### Rules

1. **Always use `ctx.fetch` / `ctx.fetchJson`.** Bare `fetch()` bypasses the rate limiter and the retry-with-backoff layer.
2. **Normalize to canonical field names.** See `knowledge/canonical-scanner-schema.md` for the full vocabulary. Anything you don't recognize, drop into `description` or `title`.
3. **One source = one host.** If a source needs two hosts, write two sources and `runSources` them together.
4. **Set `skipCanonical: true` only for probe sources.** Anything that produces rows should go through canonical persistence by default.

---

## Step 3 — Add to a dispatcher

Bundle related sources together so they share a cron job:

```ts
// supabase/functions/_shared/scanner-sources-batch-2.ts
export const BATCH_2_SOURCES = [
  attomPropertySnapshot,
  rentcastSaleListings,
  rentcastRentalListings,
];
```

Then a thin edge function that the cron calls:

```ts
// supabase/functions/scanner-sources-run-batch-2/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { runSources } from "../_shared/source-framework.ts";
import { BATCH_2_SOURCES } from "../_shared/scanner-sources-batch-2.ts";

Deno.serve(async () => {
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const results = await runSources(sb, BATCH_2_SOURCES, { concurrency: 2 });
  return new Response(JSON.stringify({ ok: true, results }, null, 2));
});
```

Register it in `supabase/config.toml` so it accepts unauthenticated cron pings:

```toml
[functions.scanner-sources-run-batch-2]
verify_jwt = false
```

---

## Step 4 — Volume strategy (so the DB never runs dry)

If a single upstream call only covers part of your market (e.g. one zip code at a time),
**rotate inputs across runs** so a daily cron covers the whole state over the cron window:

```ts
const DEFAULT_MI_ZIPS = ["48201", "48226", "48104", /* … */];
function getRotatingZip(): string {
  const day = Math.floor(Date.now() / 86_400_000);
  return DEFAULT_MI_ZIPS[day % DEFAULT_MI_ZIPS.length];
}
```

Also export a **minimum-row floor** so the dispatcher alerts when the upstream goes thin:

```ts
export const BATCH_2_MIN_ROWS: Record<string, number> = {
  attom_property_snapshot: 25,   // we expect ≥25 rows per zip per day
  rentcast_sale_listings:  5,
};
```

The dispatcher writes an `INFO`/`WARN` row into `scanner_alerts` when any source comes
back under floor — `scanner-monitor-alert` then escalates if the alert persists 24h.

---

## Step 5 — Schedule the cron

Add a pg_cron migration that pings the dispatcher daily:

```sql
-- supabase/migrations/2026MMDDHHMMSS_scanner_batch_2_cron.sql
select cron.schedule(
  'scanner-sources-run-batch-2-daily',
  '15 13 * * *', -- 9:15am ET (13:15 UTC EDT)
  $$
  select net.http_post(
    url := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/scanner-sources-run-batch-2',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY_VAULT')
    ),
    body := '{}'::jsonb
  );
  $$
);
```

---

## Step 6 — (Optional) Add a source mapping row

If the default canonical inference (`inferCategory(slug)`) maps your source to the wrong
event category, override it explicitly:

```sql
insert into scanner_source_mappings (source, entity_type, event_type, default_score, target_products, field_map)
values (
  'attom_property_snapshot',
  'place',
  'property',
  6,
  array['mortgage_radar','trade_radar','dead_lead_pool'],
  '{}'::jsonb -- empty: normalize() already wrote canonical keys
);
```

---

## Step 7 — Test locally

Unit test the source with the integration harness:

```ts
// supabase/functions/_shared/source-framework.integration.test.ts already covers:
//   - 429 retry → eventual success
//   - per-host RPS throttling
//   - normalize → canonical persistence
//   - bounded concurrency in runSources()
//   - missing API key → AUTH error code
```

Run it:

```bash
deno test --allow-net --allow-env supabase/functions/_shared/source-framework.integration.test.ts
```

Then dry-run the dispatcher with a real Supabase service-role key:

```bash
curl -X POST https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/scanner-sources-run-batch-2 | jq
```

Look for `succeeded: N`, `under_floor: []`, and no `errorCode: "AUTH"` entries.

---

## Step 8 — Verify in the monitoring dashboard

Open `/dwa-admin/scanner-monitoring`. Within ~15 min (the monitor cadence) you should see:

- Your slug appearing in the unified runs feed with ET timestamps.
- 24h success-rate widget at ≥95%.
- No `CRITICAL` / `ERROR` alerts open against your slug.

If the source fails on first deploy, the dashboard surfaces the **failing step** (`fetch`,
`circuit_breaker`, or `canonical_persist`) and the **error code** (`HTTP_429`, `AUTH`,
`TIMEOUT`, `PARSE`, etc.) — debug from there.

---

## Reference: anatomy of a source run

```
┌─────────────────────────────────────────────────────────────────┐
│ runSource(sb, def)                                              │
│                                                                  │
│  1. takeToken(host, rps)        ← token-bucket throttle         │
│  2. withBreaker(slug, …)        ← skip if breaker open          │
│  3. def.fetch(ctx)              ← upstream HTTP via fetchWithRetry
│  4. def.extractRows(payload)    ← array of raw rows             │
│  5. def.normalize(row) each     ← canonical keys                │
│  6. persistCanonicalRows(…)     ← fan into canonical_signals    │
│  7. INSERT scanner_source_runs  ← telemetry                     │
│                                                                  │
│  Errors at any step:                                            │
│   - returned as { ok:false, error, failingStep, errorCode }     │
│   - logged with the same shape                                   │
│   - NEVER thrown to the dispatcher                              │
└─────────────────────────────────────────────────────────────────┘
```

---

## Common pitfalls

| Symptom | Fix |
|---|---|
| `errorCode: AUTH`, source skipped | Add the API key secret in Lovable Cloud → Secrets |
| `errorCode: HTTP_429` repeated | Lower `rps` (try 0.5 or 0.25 — fractional values are honored) |
| `errorCode: BREAKER_OPEN` | Upstream has been failing for 5+ runs in 10 min — investigate the upstream API directly; breaker auto-resets after 15 min cooldown |
| Rows return but `under_floor` alert fires daily | Either reduce the floor in `BATCH_*_MIN_ROWS` or rotate input parameters more aggressively (Step 4) |
| Canonical signals don't appear in product UI | Run `select * from scanner_source_mappings where source = '<your_slug>'` — add a mapping row (Step 6) |
| Two sources share a host but starve each other | That's by design — token bucket is per-host. Split RPS budget by lowering each source's `rps` |

---

## Cheat sheet

```ts
import { defineSource, runSource, runSources } from "../_shared/source-framework.ts";

export const mySource = defineSource({
  slug:    "snake_case_unique_id",
  product: "mortgage_radar | trade_radar | techalert | channel_prospector | …",
  host:    "api.upstream.com",
  rps:     1,                             // default 2
  maxRetries: 3,                          // default 3
  fetch:        async (ctx) => { … },     // use ctx.fetch / ctx.fetchJson
  extractRows:  (payload) => [ … ],        // optional; default = payload if array
  normalize:    (row) => ({ … }),         // optional; canonical keys
  skipCanonical: false,                   // default false
});

await runSource(sb, mySource);
await runSources(sb, [a, b, c], { concurrency: 5 });
```

That's the whole contract.
