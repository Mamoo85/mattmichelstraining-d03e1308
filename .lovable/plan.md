# Debug Plan — Wave 1 Batches 1C–1F Silent Failure

## What the data actually shows

Querying `trade_radar_area_signals` + `trade_radar_leads` reveals the problem is **bigger than 48h**:

| Finding | Evidence |
|---|---|
| `trade_radar_area_signals` last write: **May 4 19:01 UTC** (7 days stale, not 48h) | `SELECT MAX(created_at)` |
| Only **`tree`** vertical has produced leads since May 5; all 10 other verticals froze on May 4–5 | `trade_radar_leads` group-by vertical |
| Batch 1C (federal-area-signals) **did work through May 4** — `ffiec_hmda`, `fema_nfip_api`, `noaa_nws_alerts`, `fema_repetitive_loss` all visible | source column on area_signals |
| Batch 1D / 1E / 1F sources have **never** written a row — no `socrata_*`, `kent_arcgis`, `cuyahoga_arcgis`, `wayne_county_deeds`, `pacer_*` rows in `trade_radar_area_signals` or `trade_radar_leads` | source column query |
| Zero source_health rows for any 1C/1D/1E/1F source — only TechAlert 1A federal scanners report health | `SELECT * FROM source_health` |

So there are two distinct problems stacked on top of each other:
1. **Cron / scanner regression on May 4** — 10 of 11 verticals stopped. Tree alone is still firing (last hit May 11 11:39).
2. **1D/1E/1F have never produced data** — masked because we have no per-source telemetry and `Promise.all` `.catch(()=>[])` swallows failures.

## Why 1D/1E/1F return empty even when they "succeed"

- `runMetroPermitSignals` filters metros against `coverage_regions` via `m.matches.test(coverageRegions.join(" "))`. If `trade_radar_clients.coverage_regions` is empty or doesn't match the regex (e.g. metro expects "grand rapids" but client row has `"michigan"`), every metro is skipped silently → 0 rows, no error.
- `runCountyDeedSignals` & `runPacerBankruptcySignals` also gate on `coverage_regions`. Same risk.
- Metro/county emit `new_owner_old_home`, `foreclosure_vacant`, `cofc_<vertical>_inspection` — these are **per-address** signal types (correctly NOT in `AREA_ALERT_TYPES`), so they go through `validateLead`. If Google validation fails-closed or the address is malformed, they're quarantined silently — never appear in `trade_radar_area_signals` even when working.
- PACER emits `bankruptcy_distress` (IS in `AREA_ALERT_TYPES`) so it should land directly — its zero count means the RSS fetch itself is failing or returning empty.

## Plan

### Step 1 — Wrap every 1C/1D/1E/1F source in `withSourceHealth`

Refactor the four aggregators so each individual source call goes through the existing `withSourceHealth(sb, source_name, fetcher, {product, source_type})` wrapper from `_shared/source-health.ts`:

- `federal-area-signals.ts` → HUD ACS, FFIEC HMDA, FEMA NFIP repeat-loss, EPA ECHO, NOAA SPC mesoscale
- `metro-permits.ts` → per-metro scanners (kent_arcgis, a2_opendata, socrata_chicago, socrata_columbus, socrata_indy, socrata_milwaukee, socrata_nashville, cuyahoga_arcgis)
- `county-deeds.ts` → kent_county_deeds, cuyahoga_county_deeds, wayne_county_deeds_firecrawl
- `pacer-bankruptcy.ts` → pacer_ilnb, pacer_ohnb, pacer_insb

Pass `sb` down through the function signatures (today they only take `vertical` + region/state/zip). This unblocks per-source yield + error visibility without changing routing behavior.

### Step 2 — Add a `source_yield_log` row per scanner run

Add one debug log entry per (vertical, source) per run with `{vertical, source, count, error, duration_ms}`. Use the existing `source_health` table plus a new lightweight `console.info` line tagged `[trade-scanner:yield]` so we can grep edge function logs.

### Step 3 — Audit `trade_radar_clients.coverage_regions` content

```sql
SELECT vertical, name, coverage_regions FROM trade_radar_clients WHERE active=true;
```
Confirm at least one Matt-enrolled row has region strings that match the `METROS[].matches` regex in `metro-permits.ts` (e.g. "grand rapids", "chicago", "cleveland"). If they're all `"michigan"` or empty, **every metro/county/pacer scanner is being filtered to zero** before any HTTP call happens — that alone explains the 1D/1E/1F silence.

### Step 4 — Investigate the May 4 vertical freeze (separate root cause)

Pull last 7 days of edge logs for `trade-radar-scanner` (HTTP 200 / 500 / timeout) and the cron schedule for the daily run. Hypotheses to confirm/rule out:
- Per-vertical timeout that crashes the run before reaching `roofing`/`hvac`/etc. but after `tree` (alphabetical or array-order dependency)
- Cron auth/vault key regression on May 5 affecting all verticals except a manually-invoked tree run
- Increased aggregator latency from new 1C/1D/1E/1F calls pushing total runtime past 150s edge function ceiling

### Step 5 — One smoke run + confirmation

After Steps 1–3 land:
1. Curl `trade-radar-scanner` for one stale vertical (e.g. `hvac`).
2. `SELECT source_name, last_yield, last_error FROM source_health WHERE source_name LIKE '%pacer%' OR source_name LIKE '%socrata%' OR source_name LIKE '%kent%' OR source_name LIKE '%cuyahoga%' OR source_name LIKE '%wayne_county_deeds%' OR source_name LIKE '%ffiec%' OR source_name LIKE '%fema%' OR source_name LIKE '%epa_echo%';`
3. Each previously-silent source should now have either a non-zero yield OR a captured error message we can act on.

### Out of scope for this debug pass

- Adding new sources (Batch 1G / Wave 2)
- Refactoring `validateLead` quarantine behavior — only do this if Step 5 shows metro/county per-address rows being quarantined en masse.

## Technical notes

- `_shared/source-health.ts` already exists and is wired for Batch 1A — reuse it verbatim.
- Pass `sb` (SupabaseClient) as the first arg to each aggregator. Today they don't take it, which is exactly why no one wired health tracking.
- Keep `Promise.all(...).catch` swallowing at the scanner level (preserves resilience) — health tracking moves the visibility down one layer, where it belongs.
- No migration needed; `source_health` is already in production.
