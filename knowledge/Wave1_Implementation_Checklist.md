# Wave 1 — Implementation Checklist

**Goal:** Ship 30 high-confidence sources from `100_New_Sources_Catalog_2026.md`.
**Sources in Wave 1:** `1, 2, 4, 6, 11, 12, 13, 15, 18, 19, 21, 24, 31, 32, 33, 35, 36, 37, 39, 40, 41, 45, 46, 47, 59, 63, 64, 66, 67, 73`

---

## Foundation (do first, used by all sources)

- [x] **Migration:** `source_health` table — tracks per-source daily yield, auto-pause flag, last_run, last_error
- [x] **Helper:** `_shared/source-health.ts` — `recordSourceRun(name, count, error?)` + `isSourcePaused(name)` (implemented as `withSourceHealth()` wrapper)
- [ ] **Helper extension:** `_shared/enrichment-budget.ts` — add `enforceDailyCap(source, max)` returning bool
- [ ] **Admin view (later wave):** `SourcesSmokeReport.tsx` — read-only table of `source_health`

## Batch 1A — TechAlert federal APIs (5 sources, lowest-risk first) ✅ WIRED

All 5 implemented in `_shared/techalert-federal-scanners.ts` and wired into `techalert-prospect-hunter/index.ts` Promise.allSettled block via `runBatch1AFederal(sb)`.

- [x] **#36 DOT FMCSA carrier registrations** — `scanFMCSACarriers` (fleet repair signals MI/OH/IN/IL)
- [x] **#37 OSHA Establishment Search API** — `scanOSHAInspections` (NAICS 23 construction inspections)
- [x] **#63 Federal NPI Registry** — `scanNPIMedicalTrades` (HVAC/plumbing in healthcare facilities)
- [x] **#73 DOL WHD violations** — `scanDOLWHDViolations` (wage-violation distress signal)
- [x] **#59 Wisconsin DSPS credentials** — `scanWisconsinDSPS` (Milwaukee expansion licenses)

## Batch 1B — TechAlert extensions to existing scanners (3 sources) ✅ PARTIAL

- [x] **#66 SEC EDGAR Form D** — `scanEDGARFundings()` industry terms expanded to include water/sewer, heavy construction
- [x] **#67 USPTO PatentsView** — `scanUSPTOPatents()` CPC subclasses expanded to include F16L (pipe), H02G (electrical install)
- [ ] **#64 LARA Michigan license expansions** — extend `scanLARANewLicenses()` to also fetch corporation/LLC formations with construction NAICS

## Batch 1C — Trade Radar federal area signals (5 sources) ✅ WIRED

Implemented in `_shared/federal-area-signals.ts` (exports `runFederalAreaSignals(vertical, state, zips)`). Wired into `trade-radar-scanner/index.ts` per-vertical loop after the registry augment block. New AREA_ALERT_TYPES added: `aging_housing_tract`, `epa_water_violation_area`, `nfip_repeat_loss_zip`.

- [x] **#31 HUD CHAS housing condition** — Census ACS B25034 pre-1980 share by ZIP → `aging_housing_tract` (≥60% threshold); feeds roofing/hvac/plumbing/electrical/gutters/exterior/pest
- [x] **#32 FFIEC HMDA loan originations** — `home_improvement_loan_area` (≥15 HI loans) + `homeowner_equity_area` (≥25 refi); vertical-routed
- [x] **#33 FEMA NFIP repeat-loss zones** — OpenFEMA NfipClaims 5-yr, ≥3 claims/zip → `nfip_repeat_loss_zip` (foundation, restoration, plumbing)
- [x] **#35 EPA ECHO water-system violations** — SDWA active-violation systems → `epa_water_violation_area` (plumbing, foundation)
- [x] **#40 NOAA SPC mesoscale archive** — SPC mesoscale RSS filtered by state → `storm_wind_damage` (roofing, exterior, gutters, tree, restoration)


## Batch 1D — Trade Radar metro permit ArcGIS layers (10 sources) ✅ WIRED

Implemented in `_shared/metro-permits.ts` (exports `runMetroPermitSignals(vertical, coverageRegions)`). Wired into `trade-radar-scanner/index.ts` per-vertical loop alongside `runFederalAreaSignals` via Promise.all. Each metro is gated by regex match against `trade_radar_clients.coverage_regions`. All per-address signals flow through `validateLead` into `trade_radar_leads`. Signal types: `metro_{vertical}_permit`, `cofc_{vertical}_inspection` (GR rentals), `foreclosure_vacant` (Chicago violations).

- [x] **#1 Grand Rapids permits** — Kent County ArcGIS (`GR_Permits_Public`), keyword-routed by vertical
- [x] **#2 Grand Rapids CofC expirations** — `GR_Rental_Certificates` ≤90 days, score 7-9 by daysLeft, all 11 verticals
- [x] **#4 Ann Arbor permits** — `data.a2gov.org/resource/6gnm-uern` Socrata
- [x] **#11 Chicago building permits** — `data.cityofchicago.org/resource/ydr8-5enu`
- [x] **#12 Chicago code violations** — `data.cityofchicago.org/resource/22u3-xenr` → `foreclosure_vacant` (restoration/demo_junk/pest)
- [x] **#13 Cleveland building permits** — Cuyahoga ArcGIS
- [x] **#15 Columbus permits** — `opendata.columbus.gov/resource/qbz4-d4kx`
- [x] **#18 Indianapolis permits** — `data.indy.gov/resource/p2vj-jr2q`
- [x] **#19 Milwaukee permits** — `data.milwaukee.gov/resource/x88s-kp4n`
- [x] **#21 Nashville permits** — `data.nashville.gov/resource/3h5w-q8b7`

**Note:** Socrata dataset IDs are best-known stable IDs. Each scanner is fail-graceful (try/catch per source) — if a city changes its dataset, that one source returns [] and the scan continues.

## Batch 1E — Trade Radar county deeds (3 sources)

- [ ] **#6 Kent County deeds** (Grand Rapids) — ArcGIS new-owner + pre-1990 → all 11 verticals (`new_owner_old_home` per-address)
- [ ] **#24 Cuyahoga fiscal officer sales** (Cleveland) — ArcGIS → all 11 verticals
- [ ] **#41 Wayne Co tax foreclosure auction** — scrape → RS/DJ (`foreclosure_vacant`)

## Batch 1F — Court & legal RSS (3 sources)

Added to `signals-restoration.ts` + `signals-foundation.ts` as area signals.

- [ ] **#45 PACER NDIL bankruptcy RSS** — Illinois Northern District → `bankruptcy_distress` area signal
- [ ] **#46 PACER NDOH bankruptcy RSS** — Ohio Northern District → `bankruptcy_distress`
- [ ] **#47 PACER SDIN bankruptcy RSS** — Indiana Southern District → `bankruptcy_distress`

## Wave 1 — Verification

- [ ] After all batches: curl `trade-radar-scanner` once and `techalert-prospect-hunter` once, capture full response, verify each new source returned >0 OR logged a clean "0 results, no error" row to `source_health`
- [ ] Add summary row to `knowledge/Wave1_Results.md` (yield per source, errors if any)
- [ ] Update `CLAUDE.md` Phase notes with Wave 1 completion

## Risk register

1. **Top-10 metro Socrata endpoints** — most well-known, but Toledo/Pittsburgh use non-Socrata portals. May need Firecrawl fallback for #17, #20 (Wave 2).
2. **PACER RSS** — Free but rate-limited per IP. Mitigation: cache last-seen UUID per court, only process new entries.
3. **HUD CHAS** — tract-level data is large CSV download, not query API. Plan: cached daily fetch into `aging_housing_cache` table; signal lookup is local join.
4. **FMCSA** — Has a public lookup but mass-scanning may trigger throttle. Mitigation: filter by MC# range or state-issued date.

## Execution order (this session)

1. ✅ Write this checklist
2. Foundation migration (`source_health` table)
3. `_shared/source-health.ts` helper
4. Batch 1A — TechAlert federal APIs (5 scanners)
5. Batch 1C — Trade Radar federal area signals (`_shared/federal-area-signals.ts`)
6. Batch 1B — extensions to existing TechAlert scanners
7. (If context budget remains) Batch 1D metro permits + Batch 1E deeds + Batch 1F PACER
8. Wave 1 results doc + CLAUDE.md update

**Stop conditions:** finish each batch fully before starting next. If a source endpoint returns a different shape than expected, mark TODO in code with `// SOURCE-HEALTH-TODO:` and move on rather than blocking the wave.

---

*Generated 2026-05-11. Companion catalog: `knowledge/100_New_Sources_Catalog_2026.md`.*
