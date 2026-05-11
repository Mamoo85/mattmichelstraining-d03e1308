## Audit summary — what I verified

I traced every source from definition → aggregator → scanner → DB.

**✅ Correctly wired (Batches 1C–1F):**
- Each source has a unique slug, is wrapped in `withSourceHealth(sb, slug, fn, …)`, and fails open on error.
- The 4 aggregators each accept an optional `sb` arg — if passed, health tracking activates; if not, they still run.
- `trade-radar-scanner/index.ts` (lines 571–608) passes `sb`, `allZips`, and `allRegions` (deduped union across active clients) into all 4 aggregators via `Promise.all` with individual `.catch` so one failure can't poison the others.
- Every aggregator emits a `[trade-scanner:yield] … sources=N rows=M` log line.
- `source_health` upserts are working end-to-end (last smoke confirmed 3 rows landed).

**⚠️ Real gap #1 — Batches 1D/1F do nothing for Matt's coverage**

Matt's `coverage_regions` for all 11 verticals = `{detroit, wayne, "se michigan"}`. The aggregators gate by regex against those strings:

| Aggregator | Regex matches Matt? | Net effect |
|---|---|---|
| Federal-area (1C) | n/a — state-keyed | ✅ Runs (HUD ACS, FFIEC HMDA, NFIP, EPA, SPC) |
| Metro-permits (1D) | GR / Ann Arbor / Chicago / Cleveland / Columbus / Indy / Milwaukee / Nashville | ❌ 0 of 8 metros match "detroit/wayne/se michigan" |
| County-deeds (1E) | kent · cuyahoga · **wayne** | ✅ Only `wayne_tax_foreclosure` runs |
| PACER (1F) | NDIL · NDOH · SDIN | ❌ No E.D. Michigan district configured |

This isn't a bug in the wiring — it's a coverage gap. Matt sells in SE Michigan, but the new batches mostly target *other* metros.

**⚠️ Real gap #2 — The 11 per-vertical `signals-*.ts` files have ZERO health tracking**

The signals files Matt actually depends on (BSEED, DLBA, Wayne/Oakland/Macomb GIS, NOAA, Census, Detroit Fire, Drought Monitor, etc.) collectively make ~241 `fetch()` calls and **none are wrapped in `withSourceHealth`**. So when any of these sources break, we get the same silent failure pattern that hid the May 4 vertical freeze for a week.

**⚠️ Real gap #3 — One orphan + one naming smell**

- `signals-painting.ts` is still imported (as `scanExterior`) — file contents were rewritten in Phase 32 but the filename was never renamed. Functionally fine, just confusing during audits.
- `trade_radar_clients` still has an `active=true` `painting` row alongside `exterior` (Phase 32 migration didn't actually flip it). Means scanner double-scans painting/exterior into the same client.

No truly orphan/abandoned files were found in `_shared/`.

---

## Plan — close the three gaps

### Step 1 — Add E.D. Michigan PACER + Wayne/Oakland/Macomb deeds to Batches 1E/1F

These are 4 new sources, all free, all matching Matt's existing `coverage_regions`. Result: county-deeds runs 2 more sources for Matt; PACER runs 1.

- `_shared/pacer-bankruptcy.ts`:
  - Add `mied` district (`https://ecf.mied.uscourts.gov/cgi-bin/rss_outside.pl`, scope "E.D. Michigan", state "MI").
  - Match regex: `detroit|wayne|oakland|macomb|michigan|\bmi\b`.
  - Slug: `pacer_mied`.
- `_shared/county-deeds.ts`:
  - Add `fetchOaklandSales(vertical)` → Oakland County GIS parcel server, 90-day sales + pre-1990, slug `oakland_county_deeds`.
  - Add `fetchMacombSales(vertical)` → Macomb County GIS, same filter, slug `macomb_county_deeds`.
  - Gate both on `/oakland|macomb|se\s*michigan/`.
  - Note: these endpoints have a history of being blocked from Supabase edge runtime (see Phase 42 notes). Wrap in `withSourceHealth` so failures auto-log instead of silently zeroing — that's exactly the visibility this audit demanded.

### Step 2 — Wrap the 241 fetches in `_shared/trade-signals/signals-*.ts`

This is the biggest leverage. Without this, the May 4 freeze can recur and we won't see it.

Strategy: don't rewrite each individual `fetch()`. Instead refactor each signal file to expose its internal scanners as named functions, then have `scanSignals(sb, vertical, ctx)` call them through `withSourceHealth`. Slugs follow the existing pattern (`bseed_*`, `dlba_*`, `wayne_arcgis_parcels`, `oakland_arcgis_parcels`, `macomb_arcgis_parcels`, `noaa_alerts`, `noaa_spc_csv`, `drought_monitor`, `census_acs_pre1960`, `seeclickfix`, etc.).

Because each signal file is already structured around discrete async blocks (each `await fetch(...)` is its own logical source), this is a mechanical refactor — pull each block into a named `async function fetchXxx()`, then call it through `withSourceHealth`. No business-logic changes.

Scope: do this in **one vertical first** (`hvac` — Matt's most active vertical) to validate the pattern, then apply to the other 10 in a follow-on pass. That keeps this PR reviewable.

### Step 3 — Cleanup

- Rename `_shared/trade-signals/signals-painting.ts` → `signals-exterior.ts`; update the one import in scanner.
- Migration: `UPDATE trade_radar_clients SET active=false WHERE vertical='painting' AND email='matt@detroitwebagent.com';` (the Phase 32 migration filtered on `name` which didn't match).

### Verification after deploy

```sql
-- expect: pacer_mied + oakland_county_deeds + macomb_county_deeds rows
SELECT source_name, last_run_at, last_yield, last_error
FROM source_health
WHERE source_name IN ('pacer_mied','oakland_county_deeds','macomb_county_deeds')
   OR source_name LIKE 'bseed_%' OR source_name LIKE 'dlba_%'
ORDER BY last_run_at DESC NULLS LAST;
```

After tomorrow's 12:00–12:20 UTC cron cycle, every source touched should have a row. If any are missing, the wrapper didn't get applied → fix immediately.

### Out of scope (deferred)

- Adding new metros to Batch 1D (Chicago/Cleveland/etc. don't serve Matt). When Matt enrolls a real client in those cities, we just add their `coverage_regions` — code is already ready.
- The "span folders" check: confirmed no orphan files in `_shared/` — every `.ts` is imported somewhere. The `signals-painting.ts` filename is the only naming smell, addressed in Step 3.

### Technical notes

- Each `signals-*.ts` file has 15–32 fetches. Total ~241 sources across 11 files. Step 2 done one-vertical-at-a-time keeps each PR ≤ 1 file refactor.
- `withSourceHealth` already fails-open and returns `[]` on error, so wrapping is non-breaking even for sources that occasionally 404.
- The `_shared/source-health.ts` table has `daily_cap` (default 200) — for high-volume sources like BSEED that legitimately return 200+ rows, we may want to bump caps. Will set per-source caps in Step 2 based on observed yield.
- No DB migrations needed for Steps 1 & 2. Step 3 needs one tiny migration to deactivate the duplicate `painting` row.
