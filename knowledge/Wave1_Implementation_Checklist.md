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

## Batch 1C — Trade Radar federal area signals (5 sources)

These write to `trade_radar_area_signals` (already in AREA_ALERT_TYPES pattern). Added as new shared utility `_shared/federal-area-signals.ts` called by `trade-radar-scanner/index.ts`.

- [ ] **#31 HUD CHAS housing condition** — tract-level aging-housing area signal feeding R/H/P/E/G/EX
- [ ] **#32 FFIEC HMDA loan originations** — refi/HI loan density by census tract → `home_improvement_loan_area` (extends current usage to all 11 verticals + top-10 metros)
- [ ] **#33 FEMA NFIP repeat-loss zones** — zip-level → `nfip_flood_area` feeding F/RS/P (extend beyond current MI use)
- [ ] **#35 EPA ECHO water-system violations** — facility/zip → `lead_line_area` feeding P
- [ ] **#40 NOAA SPC mesoscale archive** — extend `signals-roofing.ts`/`signals-exterior.ts`/`signals-gutters.ts` with daily mesoscale convective archive (richer than current Day-1 outlook)

**New AREA_ALERT_TYPES to add:**
- `aging_housing_tract` (#31)
- `epa_water_violation_area` (#35)
- `nfip_repeat_loss_zip` (#33 — variant of existing `nfip_flood_hvac`)

## Batch 1D — Trade Radar metro permit ArcGIS layers (10 sources)

These extend existing signal files. For each: add a `scanCityXyzPermits()` function gated by `coverage_regions` containing the metro name in client config.

- [ ] **#1 Grand Rapids permits** — extend signals-roofing/hvac/plumbing/electrical/gutters/exterior — Kent County ArcGIS
- [ ] **#2 Grand Rapids CofC expirations** — all 11 verticals → `cofc_*_inspection` signal types
- [ ] **#4 Ann Arbor permits** — A2OpenData Socrata → signals-roofing/hvac/plumbing/electrical/exterior
- [ ] **#11 Chicago building permits** — `data.cityofchicago.org/resource/ydr8-5enu.json` → R/H/P/E/G/EX/F
- [ ] **#12 Chicago code violations** — `data.cityofchicago.org/resource/22u3-xenr.json` → RS/DJ/X (`foreclosure_vacant`)
- [ ] **#13 Cleveland building permits** — Cuyahoga ArcGIS → R/H/P/E
- [ ] **#15 Columbus permits** — `opendata.columbus.gov` Socrata → all relevant verticals
- [ ] **#18 Indianapolis permits** — `data.indy.gov` Socrata → all relevant verticals
- [ ] **#19 Milwaukee permits** — `data.milwaukee.gov` Socrata → R/H/P/E
- [ ] **#21 Nashville permits** — `data.nashville.gov` Socrata → all relevant verticals

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
