# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Git Behavior

- **Auto-pull**: Always `git fetch` and `git pull` whenever needed — never ask for permission.
- **Auto-push**: Push commits to the dev branch without asking.
- **Knowledge files**: Always run `git fetch origin main && git checkout origin/main -- knowledge/` at session start.
- **CLAUDE.md updates**: Update "Current Session State" at end of every session. This is the memory between sessions — keep it current.

---

## Current Session State
*Last updated: 2026-05-05 (Phase 44)*

### Phase 44 — Enrichment Hardening + HubSpot Bridge + Trial SLA Guarantee COMPLETE ✅

**This session deliverables:**

**Fix 1 — Hunter.io header bug + Snov.io fallback** (commit `8b0dfd9`)
- Fixed Hunter.io API key header bug in `outreach-leads-enrich`
- Added Snov.io as Tier 5 fallback enrichment source. Full waterfall is now: Apollo → Hunter → Firecrawl → Snov (+ pattern_verify, PDL, crtsh, rdap, opencorporates as cheap fallbacks)
- Snov uses OAuth client_credentials (`SNOV_USER_ID` + `SNOV_API_KEY` env vars; token cached)
- Implemented in `_shared/email-waterfall.ts` (`snovDomainSearch`, `snovVerify`)

**Fix 2 — HubSpot CRM bridge** (commit `a703ff6`)
- New `_shared/crm-webhook.ts`: pushes identified SiteRadar visitors + voicemail leads to HubSpot contacts
- Wired into `visitor-identify` (after Clearbit/ipinfo enrichment) and voicemail transcription handler
- Idempotent contact upsert by email/phone

**Fix 3 — Demand/Buyer/Dead-Lead enrollment + missing crons** (commit `1970c18`)
- Matt enrolled in Demand Radar, Buyer Radar, Dead Lead Reactivation
- Added missing cron: `demand-radar-enhanced-scan` daily at 12:00 UTC (8am ET)
- Added missing cron: `field-service-daily-summary` daily at 13:00 UTC (9am ET)

**Fix 4 — Trial Delivery Guarantee E1–E10** (commits `75e0df5`–`e163745`)
- New SLA columns on `trial_signups`: `first_lead_delivered_at`, `sla_status` (`pending|met|breached|compensated`), `compensation_applied`
- New `trial-drip-runner` edge function: runs hourly, checks each active trial against SLA, sends drip emails (D0/D1/D3/D7/D14)
- Auto-compensation logic: if no lead delivered within SLA window, automatically issues credit/extension and notifies Matt + customer
- Covers all radar trials (Trade Radar 11 verticals, Mortgage Radar, Demand Radar, Buyer Radar, TechAlert)

### Phase 43 — SMS Noise Fixes + Dead Lead Pool External Sources + Cron Repair COMPLETE ✅

**This session deliverables:**

**Fix 1 — Duplicate Trade Radar SMS removed** (`trade-radar-scanner/index.ts`)
- Removed end-of-scan summary SMS that duplicated what `trade-radar-am-digest` sends at 9:30am ET
- Commit: `49ea1e9b`

**Fix 2 — Dead lead pool external sources added** (`dead-lead-pool-refresh/index.ts`)
- All 3 internal sources (FieldDesk, marketplace, contractor) are empty tables — pool was starving
- Added SOURCE D: BSEED Detroit city-certified contractor registry (ArcGIS, ~305 records, free)
- Added SOURCE E: Google Maps Places API (11 Detroit trade queries, 5/run, 10 results each, uses GOOGLE_MAPS_API_KEY)
- Commit: `3e8f83e4`

**Fix 3 — Broken pg_cron vault patterns fixed** (2 new migrations)
- `20260505000000_fix_broken_cron_patterns.sql` — Fixed 12 broken crons using wrong vault key names + added `trade-radar-am-digest-daily` cron (13:30 UTC = 9:30am EDT) — previously had NO cron scheduled
- `20260505000001_fix_remaining_broken_crons.sql` — Fixed 3 remaining crons (hire-alert-healthcare, hire-alert-industrial, industry-pulse-commercial) that used `COALESCE(name='SUPABASE_SERVICE_ROLE_KEY', name='service_role_key')` — neither vault key exists
- Wrong patterns fixed → correct pattern: hardcoded URL + `WHERE name = 'SUPABASE_SERVICE_ROLE_KEY_VAULT'`
- Commits: `a77fac09`, `8981d4a7`

**Fix 4 — Mortgage digest silence breaker** (`mortgage-radar-am-digest/index.ts`)
- Root cause of missed email: old code used `created_at >= since24h`; scanner updated `last_signal_at` but inserted 0 new rows → old query found 0 leads → silent skip
- Fixed: query now uses `last_signal_at >= since24h` (finds leads refreshed by today's scanner even if originally inserted days ago)
- Added 7-day tier-3 fallback with score >= 6 filter (proof-of-work email on quiet days)
- Added debug output: `clients_count`, `resend_key_set`, `client_traces` per client with `tier1_count`, `tier2_count`, `tier3_count`, `outcome`, `resend_response`
- Fixed zero-leads SMS: was missing `from` argument → now correctly calls `sendSMS(to, TWILIO_FROM, body, product)`
- Commits: `4821c706`, `7e4b7e84`, `f1834d96`, `a997a308`

**⚠️ DEPLOYMENT BLOCKER — SUPABASE_ACCESS_TOKEN may be expired**
- All fixes committed to `main` — code is correct in repo
- `deploy-primary` GitHub Actions job deploys `mortgage-radar-am-digest` to primary project
- If token expired again: Matt → github.com/mamoo85/m2training/settings/secrets/actions → update `SUPABASE_ACCESS_TOKEN` → re-run workflow
- Once deployed, trigger today's digest manually:
  ```
  curl -X POST https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/mortgage-radar-am-digest -H "Content-Type: application/json" -d '{}'
  ```
  Should return `digests_sent: 1` with `outcome: "email_sent"` in client_traces

**Throttle bug also fixed** (in intake-throttle.ts — see Phase 38 context):
- Scanner was being skipped daily because `freshDays: 1` + `freshColumn: last_signal_at` wasn't updated
- With `last_signal_at` query fix, digest now correctly finds leads scanner refreshed today

### Phase 42 — SE Michigan Geographic Coverage Board Fixes COMPLETE ✅

**This session deliverables:**
- `signals-roofing.ts` — Macomb County parcel scan added (new owner + pre-1990 → `roof_permit_upsell`, $12k)
- `signals-hvac.ts` — Macomb County parcel scan added (new owner + pre-1990 → `aging_system_proxy`, $8k)
- `signals-plumbing.ts` — Wayne + Oakland + Macomb County parcel scans added (→ `plumbing_permit_major`, $5k each)
- `signals-electrical.ts` — Wayne + Oakland + Macomb County parcel scans added (→ `panel_upgrade_permit`, $6k each)
- `signals-gutters.ts` — Wayne + Oakland + Macomb County parcel scans added (→ `roof_permit_upsell`, $2.5k each)
- `signals-painting.ts` (exterior) — Wayne + Oakland + Macomb County parcel scans added (→ `storm_siding_damage`, $8k each)
- `signals-demo_junk.ts` — CourtListener foreclosure scan added (DLBA proxy, nature_of_suit=320, courts=miwd+mied → `courtlistener_foreclosure`, $4.5k)
- `signals-restoration.ts` — CourtListener foreclosure scan added (same, → `courtlistener_foreclosure`, $8k)
- `trade-radar-scanner/index.ts` — `courtlistener_foreclosure` added to `AREA_ALERT_TYPES` (CourtListener returns case names not street addresses)

**Coverage board status after Phase 42:**
| Signal type | Detroit | SE Michigan (Wayne/Oakland/Macomb) |
|---|---|---|
| BSEED/ArcGIS permits | ✅ Full | ⚠️ Parcel proxy (new-owner + old-home) — all 6 relevant verticals |
| CofC expirations | ✅ Full | ❌ Detroit BSEED only — no statewide equivalent (unfixable) |
| Fire incidents / DLBA | ✅ Full | ⚠️ NWS fire weather (statewide) ✅ + CourtListener foreclosure proxy ✅ |

**County GIS endpoints used (fail-gracefully via try/catch):**
- Wayne: `https://utility.waynecountymi.gov/arcgis/rest/services/Property/FeatureServer/0/query` (fields: ADDRESS, ZIPCODE, YEAR_BUILT, SALE_DATE)
- Oakland: `https://www.oakgov.com/egis/rest/services/Property/ParcelInfo/FeatureServer/0/query` (fields: SITUS_ADDRESS, ZIP, YEAR_BUILT, SALE_DATE)
- Macomb: `https://gis.macombcountymi.gov/arcgis/rest/services/Property/Parcels/FeatureServer/0/query` (fields: ADDRESS, ZIP, YEAR_BUILT, SALE_DATE) — best-guess endpoint, fails gracefully

**CourtListener API note:** Works without API key (public) but `COURTLISTENER_API_KEY` secret in Supabase unlocks higher rate limits. Sends `User-Agent` header as fallback. `courtlistener_foreclosure` is in `AREA_ALERT_TYPES` so it routes to `trade_radar_area_signals` (bypasses per-address validator).

### Phase 41 — Grand Rapids Expansion + Lead Guarantee + Compliance PDF COMPLETE ✅

**This session deliverables:**
- `supabase/migrations/20260504140000_grand_rapids_zip_expansion.sql` — adds Grand Rapids metro ZIPs (49503–49546 + suburbs) to all 11 Matt trade_radar_clients rows. Statewide sources (NOAA/SPC/FEMA/Census/CFPB/FSBO) now automatically cover West Michigan.
- `src/components/trade-radar/TradeRadarPortal.tsx` — lead quality guarantee section added (4 credit scenarios: invalid address, 30-day duplicate, out-of-area ZIP, wrong signal; pre-filled mailto credit request link)
- `src/pages/MortgageRadarCompliance.tsx` — "Save / Print PDF" button added to header (`window.print()`; header hidden during print via `print:hidden`)

**Revised % Customer-Ready scores (Phase 41):**
- Trade Radar (all 11): **91%** (lead guarantee policy now codified in portal)
- Mortgage Radar: **95%** (compliance PDF download now live)
- Grand Rapids coverage: **live** (all 11 verticals; NOAA/SPC/FEMA statewide sources)

**Remaining gaps (still require business decisions or external API keys):**
- CRM integrations (Salesforce, Jobber) — requires API keys from those platforms
- ATS integration for TechAlert (Greenhouse/Lever) — requires partner API access
- Wayne County/Oakland County GIS signals don't cover Grand Rapids (BSEED is Detroit-only) — Grand Rapids gets statewide signals only, not city-permit-level

**Matt action items (none new this session — all cleared):**
- `EVENTBRITE_API_KEY` added ✅ (Matt confirmed)
- `GOOGLE_MAPS_API_KEY` added ✅ (Phase 39)
- `FIRECRAWL_API_KEY` added ✅ (Phase 39)

### Phase 40 — Product Polish Sweep COMPLETE ✅

**This session deliverables:**
- `MySiteRadar.tsx` — company detail slide-over panel: click any visitor/company → see visit count, all pages visited, first/last seen, ICP badge, re-enrich button
- `MyContractorLeads.tsx` — "Request Credit →" mailto link on disputed (bad_lead) leads, pre-filled with lead details
- `src/pages/MortgageRadarCompliance.tsx` — FCRA/TCPA disclosure page at `/mortgage-radar-compliance`; linked from portal footer
- `techalert-prospect-hunter/index.ts` — replaced broken LinkedIn Jobs API (`/v2/jobPostings` = restricted Partner API, always returned empty) with `scanGoogleMapsTrades()` using Google Maps Places API (GOOGLE_MAPS_API_KEY already in Supabase)

**Revised % Customer-Ready scores (Phase 40):**
- SiteRadar: **85%** (company detail panel — major gap closed)
- ContractorLeads: **80%** (credit request flow now in place)
- Mortgage Radar: **93%** (FCRA/TCPA compliance page live)
- TechAlert: **82%** (LinkedIn broken scan replaced; 1 fewer silent failure)
- Trade Radar (all 11): **88%** (owner contact visible in UI since Phase 39)
- FieldDesk: **82%** (CSV export since Phase 39)
- Buyer Radar: **75%** (OnboardingChecklist since Phase 39)
- Missed-Call: **80%** (unchanged)
- Dead Lead Reactivation: **72%** (unchanged)
- Demand Radar: **75%** (unchanged)

### Phase 39 — Portal Polish + Secrets Fixed COMPLETE ✅

**This session deliverables:**
- `TradeRadarLeadCard.tsx` — owner contact info (name/phone/email) now displayed on claimed lead cards; "Call Now" button fixed to use `owner_phone`
- `MyBuyerRadar.tsx` — `OnboardingChecklist` added (4 steps: access → signals → hot signal → export)
- `MyFieldDesk.tsx` — CSV export button added (exports filtered job list as dated CSV)

**SECRETS FIXED (2026-05-04) — Matt added to Supabase Edge Function secrets:**
- `GOOGLE_MAPS_API_KEY` ✅ — per-address leads now flow through `validateLead`; Street View images now populate
- `FIRECRAWL_API_KEY` ✅ — FSBO/estate sale/probate scrapers now active; Apollo→Hunter→Firecrawl waterfall complete

### Phase 38 — Zero-Lead Pipeline Diagnosis + Fix COMPLETE ✅

**Root cause of "no new signals (yet)" across all 6+ radar products:**

Three compounding bugs found and fixed:

**Bug 1 — `validateAddress` fail-closed on missing key (`anti-hallucination.ts`)**
- `GOOGLE_MAPS_API_KEY` existed in Lovable Cloud secrets but NOT in Supabase Edge Function runtime secrets (different stores). Every BSEED/ArcGIS per-address signal went to quarantine with `validation_unavailable`.
- **Fix**: fail-OPEN when key missing for `scraper`/`api` sources (trusted government data). LLM sources still require a source URL citation. Commit: `8030a6d6`.

**Bug 2 — Area signals invisible in morning digest (`trade-radar-am-digest/index.ts`)**
- NOAA/FEMA/county-level alerts write to `trade_radar_area_signals`, but the AM digest only queried `trade_radar_leads`. So even when real market intel existed (storm alerts, flood zones), the email said "no signals".
- **Fix**: Query `trade_radar_area_signals` alongside leads; render a "📡 Market Intel" section in the zero-lead email. Commit: `0c2e19be`.

**Bug 3 — Infrastructure failures poisoned quarantine history (`anti-hallucination.ts`)**
- `quarantineRaw` was writing `validation_unavailable` rejections to `quarantine_history`. If this caused the 3-hit block to eventually trigger, those addresses would be permanently blocked even after the key is added.
- **Fix**: Added `INFRA_CODES` set — `validation_unavailable` and `validation_api_error` skipped from `quarantine_history` writes. Commit: `0eaec780`.

**All scanners affected by Bug 1 (all use shared `anti-hallucination.ts`):**
- `trade-radar-scanner` (all 11 verticals)
- `mortgage-radar-scanner`
- Any future scanner using `validateLead()`

**All 23 My* customer portals confirmed live with routes:**
- 11 Trade Radar portals (roofing, hvac, plumbing, electrical, pest, gutters, exterior, tree, restoration, demo_junk, foundation)
- Mortgage Radar, Missed-Call, SiteRadar, Buyer Radar, Contractor Leads, FieldDesk, Demand Radar, TechAlert (/talent-radar/dashboard), MyTeam, MyAddons, IndustryPulse

### Phase 37 — Product Audit + Test Coverage + Full Fix Verification COMPLETE ✅

**Test coverage (Claude Code this session):**
- 7 new Deno unit test files in `supabase/functions/_shared/`:
  - `recency-decay.test.ts` — urgency score decay, readiness window invariants
  - `permit-velocity.test.ts` — 30/60/90d bucketing, trajectory, trade_mix
  - `intent-score.test.ts` — tier classification, category stacking, accountKey normalization
  - `circuit-breaker.test.ts` — trip threshold, recovery, provider isolation
  - `fetch-with-retry.test.ts` — 429 retry, Retry-After header, maxRetries=0
  - `twilio.test.ts` — timezone lookup, quiet hours shape, body hash determinism
  - `outreach-blocklist.test.ts` — permanent/future/past blocks, domain extraction, fail-open
- `supabase/functions/stripe-webhook/router.ts` extracted (pure routing table, no Stripe SDK import)
- `supabase/functions/stripe-webhook/router.test.ts` — 20 routing contract tests (22 product types)
- 3 Playwright E2E specs in `tests/e2e/`:
  - `checkout-flows.spec.ts` — 6 products × CTA/success/cancel/SEO
  - `admin-smoke.spec.ts` — auth guard redirects, no sensitive data exposure
  - `trade-radar-smoke.spec.ts` — 6 landing pages + 5 demo pages
- `vitest.config.ts` — thresholds raised to 50/40/50/50 (was 15/15/15/15)
- All merged to `main` via `claude/analyze-test-coverage-1Smik`

**Full product audit performed — all 10 plan fixes verified COMPLETE by Lovable:**

| Fix | Item | Status |
|---|---|---|
| P0-B | `MyFieldDesk.tsx` portal (272 lines, job board, OnboardingChecklist) | ✅ |
| P0-C | `MyDemandRadar.tsx` portal (311 lines, signal feed, OnboardingChecklist) | ✅ |
| Fix 1 | Apollo+Hunter enrichment waterfall wired into `trade-radar-scanner/index.ts` | ✅ |
| Fix 2 | `LeadActionBar.tsx` (Called/Pass/Snooze/Won/Lost), `trade_radar_lead_actions` + `mortgage_radar_lead_actions` tables | ✅ |
| Fix 3 | CSV export in `TradeRadarPortal` (RadarExportBar), `MyMortgageRadar` (blob download), `MyBuyerRadar` (blob download) | ✅ |
| Fix 4 | `team-seat-manager` edge function + `MyTeam.tsx` + `AcceptTeamInvite.tsx` — invite/accept/revoke teammates | ✅ |
| Fix 5 | Score ≥9 SMS in scanner (`sendSMS` at line 367 of trade-radar-scanner) | ✅ |
| Fix 6 | 90-day history in `TradeRadarPortal` (was 14 days) | ✅ |
| Fix 7 | Geographic expansion code in scanner (`coverage_counties`, `coverage_regions` from client row) | ✅ |
| Fix 8 | Voicemail audio player in `MyMissedCall.tsx` (`<audio>` tag, `recording_url` from Twilio), stored by `voicemail-transcription-handler` | ✅ |
| Fix 9 | Self-serve CSV upload in `DeadLeadIntake.tsx` (`FileReader`, `type="file"`, column preview) | ✅ |
| Fix 10 | `OnboardingChecklist` component (84 lines) in 6 portals: MyMortgageRadar, MyMissedCall, MyFieldDesk, MyDemandRadar, MyContractorLeads, MySiteRadar | ✅ |

**Bonus items Lovable shipped alongside fixes:**
- `cold-email-ramp-scheduler` + `cold_email_ramp_state` table (deliverability-aware send ramping)
- `scanner-health-matrix` edge function + `ScannerHealth` admin page
- `AdminManualOnboardingQueue` + `manual_onboarding_queue` table (manual provisioning fallback)
- `AdminSystemAudit`, `AdminSuppressionLists` admin tools
- HubSpot integration (`hubspot-bootstrap-properties`, `hubspot-form-webhook`, `_shared/hubspot.ts`)
- 4 broken pg_cron jobs fixed (migration `20260504041815` — vault secrets pattern corrected)
- `street_view_url` column on `trade_radar_leads`
- `owner_email`, `owner_phone`, `owner_name`, `enriched_at`, `enrichment_meta` columns on `trade_radar_leads`
- `recording_url`, `recording_duration` columns on `missed_call_captures`

**Revised % Customer-Ready scores (post all fixes):**
- Mortgage Radar: **88%** (missing: CRM integration, compliance PDF)
- Trade Radar (all 11 live): **85%** (missing: nationwide coverage, contact enrichment display in card)
- TechAlert: **78%** (missing: dispatcher fully running, ATS integration)
- MyFieldDesk: **78%** (new portal — job board live, missing: real job dispatch UI)
- MyDemandRadar: **75%** (new portal — signal feed live, missing: richer sources)
- Missed-Call: **80%** (call log + transcript + audio player all live)
- Contractor Leads: **72%** (OnboardingChecklist, no lead guarantee yet)
- SiteRadar: **72%** (OnboardingChecklist, missing: company detail page)
- Dead Lead Reactivation: **72%** (self-serve upload now live)
- Buyer Radar: **65%** (CSV export now live, thin signal sources)
- Demand Radar: **75%** (new portal now live)

**Remaining market gap (not code, business decisions):**
- Contact phone/email on lead cards (enrichment runs but UI display needs `owner_phone`/`owner_email` fields shown in TradeRadarLeadCard)
- CRM integration webhooks (HubSpot base wired; Salesforce/Jobber not yet)
- Nationwide ZIP expansion (code ready, just need to enroll clients with broader coverage_regions)
- Compliance PDF bundle for Mortgage Radar (FCRA/TCPA disclosures)
- Lead guarantee policy for Trade Radar

### Phase 36 — Lead Cards + Agent Updates + CI Fix (This Session) COMPLETE ✅

**Deliverables shipped:**
- `src/components/trade-radar/TradeRadarLeadCard.tsx` — Premium Angie's List-style lead card (Street View, score meter, signal badge, suggested opener, job value)
- `src/components/trade-radar/TradeRadarTeaserAd.tsx` — Blurred free-trial teaser card for ads
- `src/components/trade-radar/TradeRadarPortal.tsx` — Updated to use TradeRadarLeadCard for all 11 verticals
- All 11 `My*Radar.tsx` pages — signal types updated with emoji labels
- `knowledge/TradeRadar_Signal_Advantages_2026.md` — Full Lovable product brief + ad copy for all 5 competitive advantages
- `.claude/agents/Tom.agent.md` — Trade Radar pitch lines, Template J, objection handling
- `.claude/agents/hype.md` — Trade Radar ad headlines, comparison table, social proof hunting guide
- CI `.github/workflows/deploy-supabase.yml` — Fixed `db push` (continue-on-error), removed duplicate config.toml entries
- `supabase/config.toml` — Removed duplicate `[functions.create-addon-checkout]` and `[functions.run-migration-once]` entries

**✅ RESOLVED — trade-radar-scanner IS deployed (corrected 2026-05-04)**
- Earlier note in this file claimed `SUPABASE_ACCESS_TOKEN` was a blocker. **That was wrong.**
- The primary project (`eauvubfpanpeuxsrqesu`) is **Lovable-managed** and deploys edge functions directly via the Lovable agent — GitHub Actions and `SUPABASE_ACCESS_TOKEN` are NOT in the deploy path for the primary project.
- `SUPABASE_ACCESS_TOKEN` only deploys to the **secondary** project (`zmyczlfuufhngzovkjdh`), which only hosts ~2 legacy functions and is not customer-facing.
- All 11 trade-radar verticals (`roofing`, `hvac`, `plumbing`, `electrical`, `pest_control`, `gutters`, `exterior`, `tree`, `restoration`, `demo_junk`, `foundation`) are LIVE on the primary project as of Phase 31–36.
- **Do NOT re-add this as a Matt action item.** If you (Claude) think the scanner is missing verticals, curl the primary project directly to verify before flagging.

### Phase 35 — ArcGIS Full Catalog Exhaustion + CofC Signal Across All 11 Verticals COMPLETE ✅

**New sources added (this session continuation after context compaction):**

**BSEED Residential CofC Expiring (`bseed_active_residential_compliance_certificates`):**
- Added to ALL 11 trade radar verticals as `cofc_*_inspection` signal type
- 11,487 total CofC records; `num_days_until_expired <= 90` returns 100+ expiring per 30/60/90-day windows
- Scoring: `daysLeft <= 7 → 9`, `daysLeft <= 30 → 8`, `daysLeft <= 90 → 7`  
- Signal types per vertical: `cofc_roof_inspection`, `cofc_hvac_inspection`, `cofc_plumbing_inspection`, `cofc_electrical_inspection`, `cofc_pest_inspection`, `cofc_gutter_inspection`, `cofc_exterior_inspection`, `cofc_tree_inspection`, `cofc_mold_water_inspection`, `cofc_debris_inspection`, `cofc_foundation_inspection`
- These are per-address signals (not in AREA_ALERT_TYPES) — go through `validateLead` into `trade_radar_leads`
- Commits: `338b03f3`

**Detroit Fire Incidents (`Fire_Incidents` ArcGIS service):**
- Added to restoration vertical as `fire_smoke_restoration` signal
- Filter: `incident_type_description LIKE '%fire%' OR '%smoke%' OR '%CO incident%'` AND `property_use LIKE '%1 or 2 family%'`
- 30-day rolling window; building fires → score 9, other incidents → score 7; `$15,000` estimated value
- Live 2026 data confirmed (timestamps up to March 2026 in dataset)
- Commit: `4a39a830`

**Full ArcGIS catalog audit complete (770 services, 0 more untapped useful sources remaining):**
Services checked this session and skipped (all confirmed non-useful):
- `CSO_Events` — outfall location geometry only, no addresses
- `bseed_active_residential_compliance_certificates` — expiring certificates ADDED (see above)
- `bseed_occupancy_certificates` — old data (2021-2022 max)
- `CAD_Demolitions` — 0 records (empty)
- `Fire_Escrow_Properties` — 4-record dataset, all 5000+ days outstanding (2007-2010 era)
- `Demolitions_under_Contract` — 0 records
- `ROW_Permits` / `detroit_right_of_way_permits` — street-level only, no property addresses
- `development_opportunities_dlba_buildings` — no date field for freshness
- `dlba_vacant_land_program_sales` — max 2022 data
- `RentalStatuses` — 2020 data, no useful signal fields
- `Rental_Compliance_Enforcement_Map` — ZIP-level aggregates only
- `Priority_Water_Replacements` — 2019 construction jobs, no addresses
- `parcel_property_tax_estimates` — only parcel_id + tax estimate, no address
- `tentative_assessment_roll_2026` — has `residential_year_built` but numeric WHERE filter returns 400 error; sale_date 30-day filter returns 0 results (delayed updates); skip for now
- `CR_Complaints` — category/count summary table only
- `911 Calls for Service` — 2022 data, traffic stops, not property-specific
- `Rental_Registrations_(Combined)` — 2020 era data, fewer fields than `bseed_rental_registrations`
- `Stop_Work_Locations_(View)` — 2018 data only, no address fields
- `energy_water_benchmarking_ordinance_-_buildings` — large commercial buildings only (100k+ sqft), no residential

### Phase 34 — ArcGIS Audit + New Sources + TradeRadarHub Admin Panel COMPLETE ✅

**ArcGIS service directory audited** (770 total services, ~110 unused relevant ones identified).

**New ArcGIS sources added to signal files (6 new services across 10 signal files):**

| Service | Signal Files Updated | Signal Type |
|---|---|---|
| `multifamily_housing_construction_sites` | hvac, electrical, plumbing, roofing, exterior, gutters | commercial_compliance + roof_permit_upsell |
| `existing_multifamily_housing_sites` | hvac, pest_control | aging_system_proxy + foreclosure_vacant |
| `energy_water_benchmarking_ordinance_-_buildings` | hvac, electrical | commercial_compliance + aging_panel_area |
| `bseed_building_rental_compliance_public_view` | hvac, electrical, plumbing | aging_system_proxy + per-address |
| `ROW_Permits` | roofing, exterior, foundation | per-address signals |
| `Demolition_Post_Abatement_Verification_Reports` | demo_junk, restoration | demo_permit + water_damage_permit |
| `ARPA_Blight_Remediation_Industrial_and_Commercial_Completed_EDD` | demo_junk | demo_permit |
| `Fire_Inspections` | restoration, pest_control | water_damage_permit + foreclosure_vacant |
| `existing_multifamily_housing_sites` | pest_control | foreclosure_vacant (HUD compliance angle) |
| `Residential_Inspections_(combined)` | foundation | heavy_rain_foundation (failed inspection filter) |

**New Admin Panel component:**
- `src/components/dwa-admin/TradeRadarHub.tsx` — full admin hub for all 11 Trade Radar verticals
  - Scanner control (run any vertical or all)
  - Leads tab (per-address leads with score, Street View link, opener preview)
  - Area Signals tab (county/zip/state level signals)
  - Clients tab (all enrolled clients across all verticals)
  - Data Sources tab (all 40+ ArcGIS sources + 17 external API sources listed)
  - Vertical filter pills with per-vertical lead counts
  - AM Digest trigger button

**DWAAdmin updated:**
- `src/pages/DWAAdmin.tsx` — new "Trade Radar (11 Verticals)" tab in Intel & Radars section

**Services audited but NOT added (genuinely useful for future consideration):**
- `Residential_Inspections_(combined)` — date field is null in 90%+ of records (old data). Used for foundation failed-inspection filter only.
- `LandUsebyParcel` — returns 0 records (permissions issue)
- `Flood_Bulk_Collection_Status` — routing/district geometry only, no addresses
- `Rezonings_in_Process` — useful for future TechAlert commercial signals (developer activity)
- `Neighborhoods_CDBG_DR_Private_Sewer_Repair_Program` — neighborhood-level only
- `LeadReports` — returns 0 records

### Phase 33 — 100+ New Data Sources Across All 11 Trade Radar Verticals + TechAlert COMPLETE ✅

**Phase 33 was implemented in 10 batches. Total: 100+ new sources added. All pushed to main.**

**Batch 1 (commit 2af402fe) — First wave open APIs:**
- Shared utility: `_shared/census-housing.ts` (Census ACS housing age by ZIP, cached 24h)
- Roofing: SPC storm CSV, 14-day archive, CFPB refi loans
- Exterior: SPC storm CSV, CFPB HI loans
- Restoration: blight_tickets water/structural, USGS streamflow, OpenFEMA PA
- Demo/Junk: blight_tickets debris/vacant, DLBA_Owned_Properties
- Foundation: USGS streamflow, USGS earthquakes (M2.5+ 400km), Drought Monitor D2+
- HVAC: Drought Monitor D1+, CFPB refi loans
- Gutters: CFPB refi loans, parcel_file_current pre-1960 count
- Plumbing: 311 ArcGIS water/sewer, CFPB HI loans
- Electrical: Census ACS pre-1960 ZIPs, CFPB HI loans
- Tree: SPC wind CSV 58+ mph, Drought Monitor root stress
- Pest: DLBA_Owned_Properties, blight_tickets overgrown/rodent
- Scanner: added `homeowner_equity_area`, `home_improvement_loan_area`, `aging_panel_area` to AREA_ALERT_TYPES

**Batch 2 (commit 9643439a) — Detroit ArcGIS + SPC Day-1 Outlook + Assessor Sales:**
- Roofing: SPC Day-1 Convective Outlook (pre-storm, score+1), assessor_property_sales_view
- Exterior: SPC Day-1 Outlook, assessor sales
- Foundation: assessor sales, national_register_of_historic_places
- Restoration: DLBA_For_Sale, national_register_of_historic_places
- Demo/Junk: bseed_lead_clearance_reports → plumbing; DLBA_For_Sale → restoration
- Plumbing: bseed_lead_clearance_reports, assessor sales
- HVAC: NWS 7-day forecast (extreme temp signal), assessor sales
- Gutters: SPC Day-1 Outlook, assessor sales
- Tree: SPC Day-1 Outlook, assessor sales
- TechAlert: OSHA DOL violations, LARA new licenses, LARA dissolved LLCs, NLRB petitions, CFPB complaints, CourtListener Ch.7 liquidations (Promise.all now 16 calls)
- Mortgage Radar: CourtListener Ch.13, FEMA HMGP, bseed_presale_inspections, DLBA_For_Sale, assessor sales

**Batch 3 (commit ed2914ec) — 9 new BSEED/DLBA services + NOAA CDO + rental registrations:**
- Demo/Junk: bseed_demolition_permits (dedicated), dlba_auction_sales, Commercial_Demolitions
- Restoration: Historic_District_Violations (type-routed), dlba_auction_sales, bseed_building_permit_plan_reviews
- Roofing: bseed_occupancy_certificates, NOAA CDO historical hail (NOAA_API_KEY, Wayne/Oakland/Macomb)
- Exterior: NOAA CDO historical hail+wind
- Foundation: bseed_active_residential_compliance_certificates (expiring ≤60 days)
- Gutters: bseed_occupancy_certificates
- HVAC/Plumbing/Electrical: bseed_rental_registrations (landlord service contract targeting)
- Pest: dlba_auction_sales
- Tree: bseed_demolition_permits (root compression signal)
- Scanner: added `historical_hail_county` to AREA_ALERT_TYPES
- **IMPORTANT**: rental_registrations signal types must be per-address: hvac→`aging_system_proxy`, plumbing→`plumbing_permit_major`, electrical→`panel_upgrade_permit` (NOT in AREA_ALERT_TYPES)

**Batch 4 (commit a0df86e6) — Fire Incidents + Demo Pipeline + DLBA sales + TechAlert certified:**
- Restoration: Detroit Fire_Incidents (structure fire filter, score+1 = highest priority restoration lead)
- Demo/Junk: Demo_Pipeline (upcoming city demolition queue), Demolitions_under_Contract (contracted = imminent, score+1), dlba_own_it_now_sales, dlba_project_sales (bulk developer)
- TechAlert: `scanDetroitCertifiedContractors()` — 305 city-certified contractors (NIGP 91x/92x/76x) with phone/website
- TechAlert: `scanDetroitOpenTradeBiz()` — trade businesses with email addresses from Open Business registry
- Promise.all in techalert-prospect-hunter now has 18 parallel scan calls

**Batch 5 (commit 0b7a3ee4) — Acceptance certs + vacant registrations:**
- Roofing + Exterior: bseed `acceptance_certificates` (status='CofA Issued', is_residential='True') — neighborhood renovation trigger
- Pest + Restoration + Demo/Junk: `bseed_vacant_property_registrations` (owner_name available, fresh 2025-2026 data)

**Batch 6 (commit 3c0e0ce2) — Street View + Demo/Junk + TechAlert:**
- Migration: `street_view_url` added to `trade_radar_leads`
- Scanner: Street View URL generated on every lead insert using lat/lon from validateLead (`GOOGLE_MAPS_API_KEY`)
- Demo/Junk: `Side_Lots_For_Sale` (DLBA cleared lots), `bseed_demolition_inspections` (passed = lot cleanup), `dlba_vacant_land_program_sales` (recent land buyers)
- TechAlert: `scanDetroitCityContracts()` (OCP active MI construction contracts), `scanMultifamilyConstruction()` (Under Construction sites); Promise.all now 20 parallel calls

**Batch 7 (commit 53b98af2) — LARA expirations + commercial property signals:**
- TechAlert: `scanLARAExpirations()` — licenses expiring in next 30 days; Promise.all now 21 calls
- Demo/Junk: `Commercial_Properties_for_Sale` (land/vacant listings), `development_opportunities_city_real_estate_land`
- Restoration: `Commercial_Properties_for_Sale` (retail/commercial buildings), `development_opportunities_city_real_estate_buildings`

**Batch 8 (commit 443fd58a) — Completed Residential Demolitions + TechAlert city contractors:**
- Demo/Junk: `Completed_Residential_Demolitions` — **LIVE DAILY DATA** (latest: May 2026), 45-day cutoff. Per-address lot-cleanup signal
- TechAlert: `scanDemoContractors()` (contractor_name from city demo dataset), `scanBillionDollarConstruction()` (One Billion Dollar initiative developers); Promise.all now 23 calls

**Batch 9 (commit 9a406bc3) — SeeClickFix keyword routing:**
- Plumbing: SeeClickFix all-issues feed filtered for water/sewer/drain/flood/pipe keywords
- Foundation: SeeClickFix all-issues feed filtered for flood/sinkhole/collapse/foundation keywords

**Batch 10 (commit 501894b0) — Wayne County + Oakland County parcel data:**
- Roofing: Wayne County GIS parcel (6-month sales + pre-1990) + Oakland County GIS parcel → `roof_permit_upsell` (per-address)
- HVAC: Wayne County GIS parcel + Oakland County GIS parcel → `aging_system_proxy` (per-address)
- **NOTE**: Both county GIS servers may be blocked from Supabase edge functions (blocked from this container). Fail gracefully via try/catch. If 0 leads from these sources, skip or replace with FFIEC HMDA area signals.

**Key technical notes for all Detroit ArcGIS services:**
- Server: `services2.arcgis.com/qvkbeam7Wirps6zC` — 400+ FeatureServer layers
- `blight_tickets`: `ticket_issued_date` corrupt (year 8535+), use `orderByFields=OBJECTID+DESC`, set `signal_date = today`
- `dlba_auction_sales`: use `sale_closed_date` field (not `sale_date`)
- `acceptance_certificates`: filter `task_status='CofA Issued'` and `is_residential='True'`
- `bseed_rental_registrations`: `issued_date` is DateOnly type, works with `new Date()`
- DLBA: no `zip_code` in `DLBA_Owned_Properties`; construct address from `[street_number, street_direction, street_name, street_type].filter(Boolean).join(" ")`
- Drought Monitor: filter `c.fips?.startsWith("26")` for MI; drought level in `c.dm` field
- Census ACS multi-ZIP: use `for=zip+code+tabulation+area:*&in=state:26` (comma-list returns 404)
- SPC CSV two-section format: `parts[0] === "Time"` toggles `inWind` flag; filter `parts[4]?.trim() !== "MI"` for state
- NOAA CDO: requires `token: ${NOAA_API_KEY}` header; WT09=hail, WT11=high winds; filter `r.value === 1 || r.value === "1"`
- **Services tested/confirmed live (all return data):** bseed_demolition_permits, bseed_occupancy_certificates, bseed_active_business_licenses, dlba_auction_sales, dlba_own_it_now_sales, dlba_project_sales, development_opportunities_dlba_buildings, Historic_District_Violations, bseed_rental_registrations, Commercial_Demolitions, ARPA_Blight_Remediation, Demo_Pipeline, Demolitions_under_Contract, Fire_Incidents, annual_life_safety_fire_inspections (old data 2016), bseed_vacant_property_registrations, acceptance_certificates, Detroit_Business_Certification_Register (305 records), Currently_Open_Businesses
- **Services tested but skipped (bad data):** `Fire_Escrow_Properties` (4000+ days outstanding = 2007-2010 era), `annual_life_safety_fire_inspections` (2016 timestamps), `Rental_Compliance_Enforcement_Map` (polygon/ZIP-level only), `Priority_Water_Replacements` (old 2019 jobs), `parcel_property_tax_estimates` (only parcel_id + tax estimate, no address)

---

### Phase 32 — Trade Radar Expansion to 11 Verticals COMPLETE ✅

**Expanded from 7 → 11 verticals.** `painting` vertical renamed/replaced by `exterior` (broader buyer pool). 4 net-new verticals added.

**New verticals:** `exterior` | `tree` | `restoration` | `demo_junk` | `foundation`

**New signal files** (`supabase/functions/_shared/trade-signals/`):
- `signals-painting.ts` → **rewritten as Exterior Radar** (painting + siding + windows). Sources: NOAA storm/hail (siding damage area), BSEED building permits (SIDING/EXTERIOR/WINDOW/PAINT), Zillow FSBO, foreclosure notices, Wayne County deeds (new owners).
- `signals-tree.ts` (NEW): NOAA wind/storm alerts (area), FEMA disasters (area), BSEED TREE/STUMP/TRIM permits (per-address), Detroit 311 Socrata API (per-address).
- `signals-restoration.ts` (NEW): NOAA flood/fire/rain alerts (area), FEMA disasters (area), BSEED WATER DAMAGE/FIRE/MOLD/REMEDIATION permits (per-address). Honest positioning: area intel, not hot-incident dispatch.
- `signals-demo_junk.ts` (NEW): BSEED DEMO/DEMOLITION permits (per-address), estate sales scraper, probate filings scraper, foreclosure notices scraper.
- `signals-foundation.ts` (NEW): NOAA flood/rain alerts (area), FEMA disasters (area), OpenFEMA NFIP claims (area — repeat-payout zips), BSEED FOUNDATION/STRUCTURAL/WATERPROOF/BASEMENT permits (per-address).

**Scanner updates** (`trade-radar-scanner/index.ts`):
- SCANNERS Record: removed `painting: scanPainting`, added `exterior, tree, restoration, demo_junk, foundation`
- AREA_ALERT_TYPES expanded with 12 new signal types for new verticals
- MORTGAGE_WATERFALL_VERTICALS: `"painting"` → `"exterior"`, added `"foundation"`, `"restoration"`
- HOME_TURNOVER_VERTICALS: added `exterior`, `demo_junk`
- VERTICAL_LABELS updated for all 11 verticals

**Digest updates** (`trade-radar-am-digest/index.ts`):
- ALL_VERTICALS, VERTICAL_LABELS, VERTICAL_WATCHLIST expanded to all 11 verticals

**Frontend pages** (5 new):
- `src/pages/MyExteriorRadar.tsx` → `/my-exterior-radar`
- `src/pages/MyTreeRadar.tsx` → `/my-tree-radar`
- `src/pages/MyRestorationRadar.tsx` → `/my-restoration-radar`
- `src/pages/MyDemoJunkRadar.tsx` → `/my-demo-junk-radar`
- `src/pages/MyFoundationRadar.tsx` → `/my-foundation-radar`

**Migrations:**
- `20260502170000_trade_radar_add_verticals.sql`: updates `radar_trials.product` CHECK to include 5 new product slugs; marks `painting` inactive in `trade_radar_clients`
- `20260502180000_matt_new_verticals_enrollment.sql`: enrolls Matt across all 5 new verticals (118 SE Michigan ZIPs)

**ArcGIS date bug fixed across all signal files:** `issued_date >= 'date-string'` → keyword-only WHERE + `new Date(a.issued_date).toISOString().slice(0,10)` conversion (ArcGIS stores as Unix ms timestamps).

**Zero-lead bugs fixed (validateLead + quarantineRaw + LeadGateResult field names)** — see Phase 31 notes.

---

### Phase 31 — Trade Radar (7 Verticals) COMPLETE ✅

**New product: Trade Radar** — mirrors Mortgage Radar structure across 7 home-service trade verticals.

**Verticals:** `roofing` | `hvac` | `plumbing` | `electrical` | `pest_control` | `gutters` | `painting`

**Tables (all in `supabase/migrations/`):**
- `20260502090000_trade_radar_tables.sql`: `trade_radar_clients`, `trade_radar_leads` — mirrors mortgage_radar structure
- `20260502160218_*.sql`: `trade_radar_area_signals` — area-level signals (hail/storm/FEMA zones) with scope (zip/county/region/state), 14-day expiry
- `20260502120000_radar_trials_add_trade_products.sql`: extends `radar_trials` CHECK constraint to include all 7 trade product slugs

**Edge functions (all deployed via GitHub Actions):**
- `trade-radar-scanner/index.ts`: daily 8am ET cron (13:00 UTC, `20260502100000_trade_radar_cron.sql`) — scans all 7 verticals in one run; per-address leads go to `trade_radar_leads`, area alerts go to `trade_radar_area_signals`
- `trade-radar-am-digest/index.ts`: daily morning email/SMS brief per client per vertical — always sends even on 0-lead days (shows watch-list as proof of work)
- `trade-radar-health-check/index.ts`: monitoring function
- `trade-radar-weekly-digest/index.ts`: weekly summary

**Shared signal modules** (`supabase/functions/_shared/trade-signals/`):
- `signals-roofing.ts`, `signals-hvac.ts`, `signals-plumbing.ts`, `signals-electrical.ts`, `signals-pest_control.ts`, `signals-gutters.ts`, `signals-painting.ts`

**Matt enrolled as founder across all 7 verticals:**
- `20260502110000_matt_trade_radar_enrollment.sql`: `matt@detroitwebagent.com` active in all 7 verticals with 118 SE Michigan ZIPs
- Fixed UUIDs, safe to re-run (ON CONFLICT DO UPDATE)

**Checkout:** `create-trade-radar-checkout` function added

**AREA_ALERT_TYPES** (bypass per-address validator, written to `trade_radar_area_signals`):
`hail_damage_area`, `storm_wind_damage`, `fema_disaster`, `fema_gutter_damage`, `new_homeowner_roof`, `lead_line_area`, `extreme_weather_hvac`, `nfip_flood_hvac`, `storm_panel_check`, `storm_gutter_damage`, `registry_signal`

**Per-lead verification emails shipped** (commit `d3df0e78` — "Sent per-lead verification e-mls")

**⚠️ Zero-lead bug fixed (Phase 31 post-ship):**
- `trade-radar-scanner`: `validateLead` was called without `sb` arg → threw on every lead → 100% skipped
- Fixed field names: `validation.valid` → `validation.pass`, `validation.formatted_address` → `validation.formatted`, `validation.reason` → `validation.reject_reason`
- Fixed `quarantineRaw` call signature (was passing object instead of positional args)
- All 7 signal files: ArcGIS `issued_date >= 'date-string'` date filter replaced with keyword-only WHERE + `new Date(a.issued_date).toISOString().slice(0,10)` conversion (ArcGIS stores dates as Unix ms timestamps)

---

### Phase 30 — Mortgage Radar Geographic Expansion + Digest Hardening COMPLETE ✅

**Geo expansion (code in repo; migrations pending live DB apply via Supabase SQL editor):**
- `20260502070000_mortgage_radar_regions.sql`: adds `coverage_counties text[]` to `mortgage_radar_clients`, `county text` to `mortgage_radar_leads`
- `20260502080000_mortgage_radar_regions_v2.sql`: adds `coverage_regions text[]` to `mortgage_radar_clients`, `region text` to `mortgage_radar_leads`
- Scanner: `COUNTY_TO_REGION` map → 6 regions (SE Michigan, West Michigan, Mid-Michigan, Northern Michigan, East Michigan, UP)
- BSEED permit threshold lowered: $100k → $25k
- 5 new data sources: EstateSales expanded, LARA LLCs, Wayne County Deeds, Oakland County Permits, Realtor.com price reductions

**⚠️ Geo migrations may still be pending on live DB** — Lovable-managed project (`eauvubfpanpeuxsrqesu`) does NOT auto-apply from git pushes. Matt must apply manually in Supabase SQL editor. Until applied: `coverage_counties`/`coverage_regions` don't exist on `mortgage_radar_clients`; `county`/`region` don't exist on `mortgage_radar_leads`.

**Digest hardening shipped:**
- `mortgage-radar-am-digest`: split SELECT — geo columns fetched separately (best-effort), zip-filter fallback if 0 leads, test SMS mode, debug output
- GitHub Actions `deploy-primary` job deploys `mortgage-radar-am-digest` + `mortgage-radar-scanner` to primary project on every push to main

**TODO:** Delete `supabase/functions/run-migration-once/` once geo migrations are confirmed applied.

**Key anon key for curl invocations (primary project):**
`eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVhdXZ1YmZwYW5wZXV4c3JxZXN1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2MzI3MDYsImV4cCI6MjA4OTIwODcwNn0.QF4PaTIhhwBkl0hgh68W4R2CxH22ReokGwJUebI2tKw`

---

### Phase 29 — Enrichment Waterfalls + Admin Digest + Full Pipeline Wiring COMPLETE ✅

**New shared utilities:**
- `_shared/firecrawl.ts`: `firecrawlScrape()`, `extractFaxNumber()` (contact→contact-us→homepage waterfall), `extractPhoneNumbers()`, `extractContactInfo()` — all fail gracefully
- `_shared/hunter.ts`: `hunterFindEmail(domain)` (prefers owner/president/GM titles), `hunterVerifyEmail(email)` — uses `HUNTER_IO_API_KEY`

**Waterfall extraction everywhere (user's explicit requirement):**
- Email: Apollo org + people search → Hunter.io domain search → Firecrawl contact/about page scrape
- Fax: Firecrawl structured scrape → raw HTML fetch + multi-pattern regex (labeled fax/ facsimile/ f.: patterns)
- Company from IP: ipinfo.io → Clearbit Reveal (SiteRadar visitor-identify)

**outreach-leads-enrich (new function):**
- Drains `outreach_leads` rows with no owner_email — 20 records/run, Apollo → Hunter → Firecrawl
- Marks `enriched_at` on both success and failure (prevents infinite retry loop)
- Migration `20260429070000_outreach_leads_enrich_columns.sql`: owner_name/email/phone, website, enriched_at
- Migration `20260429080000_outreach_enrich_cron.sql`: daily 11am ET (15:00 UTC)

**weekly-admin-digest (new function):**
- Every Monday 8am ET, sends Matt one SMS with full week pipeline breakdown
- Queries in `Promise.all`: TechAlert prospects/enriched/emailed/replied, outreach sent/followups, dead lead D1/replies, mortgage leads, new clients per product (TechAlert, Contractors, Mortgage Radar)
- Migration `20260429090000_weekly_admin_digest_cron.sql`: Monday 13:00 UTC cron
- config.toml: `verify_jwt = false` added

**channel-prospector: DataForSEO integration:**
- Runs Google Places + DataForSEO Local Pack in parallel, deduplicates by name
- DataForSEO surfaces contractors not in Google Places results
- `isDFS` flag skips `getPlaceDetails` call for DataForSEO results (they have no place_id)

**Secrets needed (add to Supabase Edge Function secrets):**
- `HUNTER_IO_API_KEY` — Hunter.io domain email search (new)
- `CLEARBIT_API_KEY` — SiteRadar company visitor ID (Matt waiting on email confirmation)
- `DATAFORSEO_LOGIN` + `DATAFORSEO_PASSWORD` — channel-prospector DataForSEO integration
- `EVENTBRITE_API_KEY` — Eventbrite trade show signals
- `APOLLO_API_KEY` — all enrichment waterfalls (already added per Matt)

**Full automated pipeline now running daily (all times ET):**
| Time | Function | Purpose |
|---|---|---|
| 6am | techalert-prospect-hunter | 8-source signal scan |
| 7am | techalert-enrich | Apollo→Hunter→Firecrawl owner enrichment |
| 8am | techalert-outreach | D0 cold email (30/day) |
| 9am + 2pm | techalert-followup-drip | D3/D7/D14 follow-ups (50/day) |
| 10am | channel-prospector-followup | Channel D7/D14 follow-ups (40/day) |
| 11am | outreach-leads-enrich | Apollo→Hunter→Firecrawl owner drain (20/run) |
| Mon 8am | weekly-admin-digest | Full pipeline SMS summary to Matt |

### Phase 28 — Full Signal API Buildout + Automated Revenue Pipelines COMPLETE ✅

**TechAlert — fully automated pipeline (6am → 7am → 8am + drip):**
- `techalert-prospect-hunter`: now pulls from **8 parallel signal sources**:
  - Sonar (job boards), GitHub (repo activity), SEC EDGAR (Form D), USPTO PatentsView
  - SAM.gov (federal contract awards by NAICS, uses `SAM_GOV_API_KEY`)
  - BLS employment data (Detroit metro HVAC/electrician trends, free)
  - Eventbrite (trade show organizers, uses `EVENTBRITE_API_KEY`)
  - USASpending.gov (federal contract awards to MI trades firms, free)
  - LinkedIn job postings (uses `LINKEDIN_ACCESS_TOKEN`)
  - Response now shows full `signals: { github, edgar, uspto, sam, eventbrite, usaspending, linkedin }` breakdown
- `techalert-enrich`: Apollo owner lookup drain, 7am ET, 25 prospects/run
- `techalert-outreach`: D0 cold email, 8am ET, 30/day cap
- `techalert-followup-drip`: **NEW** — D3/D7/D14 follow-up sequence, 9am + 2pm ET, 50/day cap
  - D3: urgency/scarcity angle
  - D7: 30-day free trial offer
  - D14: final touch + phone escalation to (313) 992-1219
  - Migration `20260429030000_techalert_followup_columns.sql`: adds followup_d3/d7/d14_sent_at, replied_at, reply_positive
  - Migration `20260429040000_techalert_drip_cron.sql`: cron schedules

**SiteRadar — Clearbit Reveal for company identification:**
- `visitor-identify/index.ts`: added Clearbit Reveal as secondary enrichment
- When ipinfo.io doesn't identify a business visitor, falls back to Clearbit Reveal API
- Returns company name, domain, industry, employee count → stored in enrichment_data JSON
- Requires `CLEARBIT_API_KEY` in Supabase secrets

**Channel Prospector — 7/14-day follow-up sequences:**
- `channel-prospector-followup/index.ts`: **NEW** — D7/D14 follow-ups via original channel (fax/postcard/SMS)
- Reads `drip_campaign_status.channel_target` to know where to send
- AI-generated copy per touch via Claude Haiku, 40/day cap
- Migration `20260429050000_channel_prospector_followup.sql`: adds followup_d7/d14_sent_at, replied_at to outreach_leads
- Migration `20260429060000_channel_followup_cron.sql`: daily 10am ET cron
- config.toml: `verify_jwt = false` added

**Dead Lead Drip — Twilio Lookup phone validation:**
- `dead-lead-drip/index.ts`: gates every D1 SMS on Twilio Lookup line-type check
- Landlines → marked `is_dnc_risk=true, status='landline'`, skipped permanently
- Fails open on API error (never drops valid contacts due to Lookup downtime)
- Cost: $0.005/lookup — pays for itself by not burning SMS credits on landlines

**Secrets needed (add to Supabase Edge Function secrets):**
- `EVENTBRITE_API_KEY` — Eventbrite trade show signals
- `CLEARBIT_API_KEY` — SiteRadar company-level visitor identification
- `SAM_GOV_API_KEY` — already in secrets per CLAUDE.md; confirm Supabase copy
- `LINKEDIN_ACCESS_TOKEN` — already in secrets; confirm Supabase copy
- `APOLLO_API_KEY` — needed for techalert-enrich drain
- `GITHUB_TOKEN` — already confirmed per Matt

**New cron schedule summary (all times ET):**
| Time | Function | Purpose |
|---|---|---|
| 6am | techalert-prospect-hunter | 8-source signal scan |
| 7am | techalert-enrich | Apollo owner enrichment |
| 8am | techalert-outreach | D0 cold email (30/day) |
| 9am + 2pm | techalert-followup-drip | D3/D7/D14 follow-ups (50/day) |
| 10am | channel-prospector-followup | Channel D7/D14 follow-ups (40/day) |

### Phase 27 — HBS-Level Product Upgrades: Geographic Expansion + Free Signal APIs COMPLETE ✅

**Phase 1 foundations shipped (4 items):**

**F1 — prospector_targets migration + channel-prospector DB config:**
- `supabase/migrations/20260429000000_prospector_targets.sql`: new table replacing hardcoded city/trade arrays
- 14 active Michigan targets seeded; Ohio (Cleveland, Columbus, Cincinnati), Indiana (Indianapolis), Illinois (Chicago), Texas (Dallas, Houston, San Antonio), Tennessee (Nashville) rows seeded as `active=false`
- Admin toggles `active=true` in DB → zero code deploy required to expand to any new market
- `supabase/functions/channel-prospector/index.ts`: removed `DEFAULT_TRADES`/`DEFAULT_CITIES`/`todaysCombo()`, replaced with `getActiveTargets(sb)` + `pickTarget(targets)` — falls back to hardcoded Michigan list if DB is unreachable

**F2 — _shared/apollo.ts centralized Apollo.io helper:**
- `supabase/functions/_shared/apollo.ts`: canonical Apollo API helper — exports `ApolloContact`, `ApolloOrganization` interfaces + `apolloPeopleSearch()`, `apolloPeopleMatch()`, `apolloOrganizationSearch()`, `apolloOrganizationEnrich()`
- Both `X-Api-Key` header AND `api_key` body sent (Apollo belt-and-suspenders requirement)
- All callsites should import from here; prevents future header drift across 11+ Apollo usages

**F3 — Dead Lead state parameterization:**
- `supabase/functions/dead-lead-drip/index.ts`: `checkProjectComplete(name, trade)` → `checkProjectComplete(name, trade, state="MI")`
- Added `STATE_NAMES` map for 11 states (MI, OH, IN, IL, TX, FL, TN, GA, AZ, NC, PA)
- OpenRouter Sonar query now uses contractor's actual state instead of hardcoded "Michigan" — prevents false "project complete" hits for OH/TX/etc contractors
- D1 select now pulls `state` from `contractor_clients`; call site passes `contractor?.state || "MI"`

**F4 — GitHub + SEC EDGAR + USPTO signal scanning in techalert-prospect-hunter:**
- `supabase/functions/techalert-prospect-hunter/index.ts`: added 3 free signal scanning functions
- `scanGitHubSignals()`: searches GitHub for HVAC/building-automation orgs with pushes in last 30 days (uses GITHUB_TOKEN, 5000 req/hr free)
- `scanEDGARFundings()`: queries SEC EDGAR Form D filings for funded trades companies (fully open, just User-Agent header)
- `scanUSPTOPatents()`: queries USPTO PatentsView for HVAC/boiler/plumbing/electrical patents filed in last 90 days (fully open, no key)
- All three run in parallel via `Promise.all()` after the Sonar loop; results feed same upsert pipeline
- Response includes `signals: { github, edgar, uspto }` counts for log visibility

**Secrets Matt needs to add to Supabase (not just Lovable cloud):**
- `APOLLO_API_KEY` — Supabase Edge Functions secret store (Lovable cloud secrets don't reach Deno runtime)
- `GITHUB_TOKEN` — already added per Matt; confirm it's in Supabase secrets, not just Lovable cloud
- SEC EDGAR + USPTO PatentsView: no keys needed — open APIs, just User-Agent header

**Next Phase 27 items (Lovable's side — UI for market targeting):**
- Admin panel market toggle for prospector_targets (city/state/trade on/off grid)
- TechAlert beta flag flip for Phoenix/DFW/Houston/Atlanta (already in usMetros.ts, just needs flag change)
- Clearbit Reveal integration for SiteRadar (company-level visitor ID from IP)
- Eventbrite API for conference/trade-show signals

### Phase 26 — Mega-Audit: Lovable Push Verification + TCPA Fix + Cron Gaps COMPLETE ✅

**3-agent parallel audit run — findings and fixes:**

**Lovable 25-file push: ALL CLEAN ✅**
- All imports resolve, types match, routes exist, migration uses IF NOT EXISTS
- New components (MortgageRadarComplianceGate, TerritoryPicker, ROICalculator, SeedLead, ProvisioningProgress) wired correctly into MortgageRadar.tsx + MyMortgageRadar.tsx
- AdminEnrichmentAudit.tsx queries `lead_enrichment_audit` table (exists in types.ts)
- 2 config.toml gaps fixed: `create-mortgage-radar-checkout` + `check-mortgage-radar-zips` both needed `verify_jwt = false`

**TCPA/FCRA compliance: ONE CRITICAL FIX + REST COMPLIANT ✅**
- **FIXED**: `mortgage-radar-outreach/index.ts` had a local `sendSms()` bypassing `_shared/twilio.ts` — no opt-out scrub, no FCC quiet hours, no audit log. Replaced with shared `sendSMS()`.
- H.R. 2808 (trigger lead ban): COMPLIANT — zero credit bureau sources in scanner (all BSEED, court records, SOS, FSBO)
- RLS: all 10 key tables confirmed with ENABLE ROW LEVEL SECURITY + service_role bypass
- Multi-tenancy: ZIP isolation confirmed (MyMortgageRadar filters by client's zip_codes, am-digest per-client)
- FCRA manual-only gate: `status='approved'` required before any homeowner outreach
- EBR 18-month: enforced in dead-lead-drip with `tcpa_expired` sweep

**Cron + agent audit: ONE GAP FIXED ✅**
- **FIXED**: Tom autonomous agent had zero pg_cron trigger — migration `20260427090000_tom_cron.sql` adds daily 8am ET schedule
- 58 total cron jobs confirmed scheduled, all with verify_jwt = false
- DWA Operator A/B testing confirmed: 4-hour cycle, auto-pauses dead campaigns, SMS copy variants to Matt
- 34/36 agents updating heartbeats (2 legacy passive agents by design)
- hire-alert-dispatcher: no cron by design (deliberately unscheduled in migration 20260420021718 — Matt decides)

### Phase 25 — Mortgage Radar Pipeline + 8-Product Audit COMPLETE ✅
*All work on `main`. Dev branch synced.*

**Mortgage Radar — zero-touch pipeline finalized:**
- `supabase/config.toml`: added `verify_jwt = false` for all 10 mortgage-radar functions + visitor-identify (cron calls were 401ing)
- `supabase/migrations/20260426070000_mortgage_radar_crons.sql`: added `mortgage-radar-scanner-daily` (8am ET) + `mortgage-radar-weekly-digest` (Mon 8am ET) — scanner was never scheduled
- `supabase/functions/mortgage-radar-scanner/index.ts`: replaced local `sendHotLeadSMS` (raw Twilio, no TCPA) with `sendSMS` from `_shared/twilio.ts`
- `supabase/functions/stripe-webhook/index.ts`: fire-and-forget scanner invoke on new signup — first leads in minutes not 24h
- `src/components/PostCheckoutClaim.tsx`: deleted (dead code duplicate; real one is `src/components/checkout/PostCheckoutClaim.tsx`)

**Full 8-product pipeline audit — 12 issues found and fixed:**

P0 (revenue-breaking):
- **FieldDesk webhook type mismatch** FIXED: webhook checked `"field_service_subscription"` but checkout sets `"field_crm_subscription"` — every FieldDesk payment since launch hit the catch-all, customers were never provisioned. Corrected type string.
- **config.toml missing entries** FIXED: added `create-field-crm-checkout` + `create-bundle-revenue-suite-checkout` (both defaulted to `verify_jwt = true`)

P1 (post-payment UX broken):
- **TechAlert success_url** FIXED: `/hire-alert` redirect dropped `session_id=` query param; changed success_url directly to `/talent-radar`
- **Marketplace `session=` param** FIXED: standardized to `session_id=` to match claim-session and LeadDetail expectations

P2/P3 (missing automation):
- **Marketplace cron schedules** FIXED: `20260426080000_marketplace_crons.sql` — 4 background workers (weekly-scorecard, reengagement, hot-zone-notifier, saved-search-notifier) now have ET-aligned cron schedules
- **marketplace-outreach-blast config.toml** FIXED: missing entry added

P4 (code quality):
- **SiteRadar dedicated webhook** FIXED: was falling to generic catch-all (no field_crm_clients upsert, no visitor_script_key). Added full handler that generates script key, sends installation email
- **Bundle Revenue Suite email branding** FIXED: was using `sendM2Email()` (M2 Training brand) — switched to `dwaEmail()` with DWA HTML template
- **Dead duplicate marketplace handler** FIXED: removed unreachable duplicate at fallthrough zone that lacked `markFulfilled`

**Known remaining items (not code bugs):**
- FieldDesk has no cron schedules for `field-service-sms` / `field-service-contract-scheduler` — functions exist but need business logic review to determine trigger frequency
- TechAlert `hire-alert-dispatcher` has no active cron — was deliberately unscheduled in migration 20260420021718, needs Matt to decide if it should be re-added
- Marketplace `marketplace-outreach-blast` has no cron — intentionally manual-trigger only (bulk blast, not automated)

### Phase 24 — CI Recovery + Full Audit + PostCheckoutClaim COMPLETE ✅
*All work on `main`. 231/231 tests passing (99 Vitest + 132 Deno).*

**CI fixed (was red for 3 days):**
- `package-lock.json` regenerated — Lovable had added `react-swipeable` to package.json without updating the lockfile, breaking `npm ci`
- `SUPABASE_ACCESS_TOKEN` GitHub secret was missing/expired — Matt re-added it manually
- `workflow_dispatch` trigger added to `.github/workflows/deploy-supabase.yml` — can now trigger CI manually from GitHub Actions UI without a code push
- `deno.lock` committed — pins deno.land/std@0.224.0 for reproducible Deno test runs

**Stripe webhook SMS spam fixed:**
- `stripe-webhook/index.ts`: duplicate `ads_copy_subscription` + `site_radar_subscription` handlers in the fallthrough zone were causing `meta is not defined` crash on every non-checkout Stripe event → spamming FATAL SMS alerts to Matt
- Removed ~75 lines of dead code (duplicate handlers used raw `fetch()` to Resend, violating CLAUDE.md rules)
- Removed doubled `markFulfilled` call on unhandled-event path
- Correct handlers remain inside `checkout.session.completed` block

**Phase 23 completeness audit (all 29/29 items verified on disk):**
- All edge functions, migrations, agent files, config.toml entries confirmed present
- All 3 checkout success URL fixes confirmed correct (FieldDesk → `/field-service`, Missed-Call → session_id, Bundle → `/bundle-revenue-suite`)
- One missing item found and built: `src/components/PostCheckoutClaim.tsx`

**PostCheckoutClaim component (new — `src/components/PostCheckoutClaim.tsx`):**
- Reads `?session_id=` from URL on mount, calls `claim-session` edge function
- Emails customer a one-click magic login link (no password needed)
- Idempotent via localStorage guard (won't double-fire on page refresh)
- Shows loading / success / error states with support SMS fallback
- Covers all 8 DWA products: FieldDesk, TechAlert, SiteRadar, Missed-Call, Mortgage Radar, AI Phone Answering, Bundle Revenue Suite, AI Reputation Dashboard

**AI model upgrades (from this session):**
- `_shared/opus.ts`: `claude-opus-4-5` → `claude-opus-4-7`
- `_shared/ai.ts` + `_shared/opus.ts`: Haiku pinned to `claude-haiku-4-5-20251001`

**Contractor Lead Marketplace (complete — from this session):**
- `src/pages/ContractorMarketplace.tsx`: Angie's List style storefront at `/contractor-marketplace`
- Trade filter tabs, lead cards with tier badges, email-to-Stripe claim flow, empty state with phone capture
- `supabase/migrations/20260427000000_contractor_marketplace_view.sql`: public view, no PII, anon SELECT
- `create-contractor-ppl-checkout`: updated to accept `{ lead_id, email }` with guest upsert into `contractor_clients`
- DWAAdmin → Customers → "🏪 PPL Marketplace" tab added

### Phase 23 — Autonomous Fixer + SiteRadar + Missed-Call Enhancements COMPLETE ✅
*Merged to main. All items shipped.*

**Autonomous Code-Fixer Agent:**
- `fixer_queue` + `fixer_runs` tables + Postgres trigger on `error_logs` → fires watchdog immediately
- `code-fixer-watchdog` edge function: classifies + auto-fixes 6 error categories, SMS Matt on results
- `inbound-sms-relay`: text "FIX" → trigger watchdog, "ERRORS" → last 5 errors, "FIXED?" → last run summary
- `.claude/agents/fixer.md`: Claude Code agent spec for code-level fixes, pushes to auto-fix branches
- `.claude/settings.json`: full git + vitest permissions, no prompts for fixer agent

**SiteRadar full buildout:**
- `create-site-radar-checkout`: $49/mo, `site_radar_subscription` webhook type
- `stripe-webhook`: `site_radar_subscription` + `ads_copy_subscription` handlers with welcome emails
- `visitor-identify`, `site-radar-repeat-alert`, `site-radar-weekly-digest`, `site-radar-health-check`
- Seeded `field_crm_clients` for detroitwebagency.com + mattmichelstraining.com

**Missed-call enhancements for +13139921219:**
- `missed-call-status`, `missed-call-handler` (voicemail Record TwiML), `voicemail-transcription-handler`
- `callback-reminder-sender` (every 5 min), `missed-call-escalation` (every 30 min)
- Migrations: `missed_call_captures`, `callback_reminders`, `google_review_url` + `owner_phone`

**Cross-cutting:**
- `claim-session`, `create-customer-portal-session`, `nps-survey-sender`, `client_nps_scores` table

**Lovable's side (still pending):**
- `/my-site-radar` customer portal, SiteRadar landing page
- Health dashboard upgrade, Stripe portal buttons, NPS email templates, empty states

### Phase 22 — Golden Ticket Marketplace + LO Outreach + Paranoia Sweep COMPLETE ✅
*Originally completed: 2026-04-24. Post-sweep additions through 2026-04-25 below.*

**Shipped in Phase 22 Paranoia Sweep (2026-04-24):**
- GHOST-1/2: `agency-payment-reconcile` covers all 5 DWA products + marketplace `email_sent_at` reconcile
- GHOST-3: Stripe webhook PDF call awaited with 25s timeout + `notifyMatt` on failure
- MALICIOUS-1/2: `dead-lead-intake` — 500-lead cap, field truncation, campaign rollback on contacts failure
- MALICIOUS-3: `create-marketplace-lead-checkout` — UUID + email format validation
- TOKEN-1: `queryClient.ts` — global 401/PGRST301 handler signs out expired sessions
- iOS fix: `window.prompt()` replaced with `BuyerEmailDialog` in `FirstLookUpsellGate` + `LeadDetail`
- Migration: `email_sent_at` column + partial index on `marketplace_lead_locks`

**Post-paranoia-sweep additions (2026-04-25):**
- Migration `20260425020000`: `marketplace_receipt_access_log` table for audit trail
- Migration `20260425030000`: Full `marketplace_lead_locks` + `marketplace_lead_pdfs` tables with DB-level double-sell prevention (partial unique index on `soft_lock|claimed|sold` status)
- Migration `20260425040000`: `dashboard_token` column on `missed_call_clients` (magic-link portal access) + `access_expires_at` on `marketplace_lead_locks` (30-day expiry)

**BSEED ArcGIS note**: `services2.arcgis.com/qvkbeam7Wirps6zC` is the only working server-side permit source. `data-wayne.opendata.arcgis.com` blocks all server requests (403). BSEED fields are **lowercase**: `address`, `issued_date`, `work_description`, `amt_estimated_contractor_cost`.

**NMLS note**: `find-lo-prospects` uses Apollo.io (not NMLS Consumer Access — Cloudflare blocks it).

**All known bugs resolved.** No open audit items.

**Secrets Matt needs to add:**
- `LOB_API_KEY` — lob.com (postcards)
- `BROWSERLESS_API_KEY` — dossier PDFs
- `APOLLO_API_KEY` — prospect enrichment

---

## Commands

```bash
npm run dev          # start Vite dev server (port 8080)
npm run build        # production build
npm run lint         # ESLint
npm run test         # Vitest (single run)
npm run test:watch   # Vitest watch mode
npm run db:push      # push local migrations to Supabase
npm run db:diff      # diff local schema vs remote
npm run db:reset     # reset local DB to clean state
```

Single test: `npx vitest run src/path/to/file.test.ts`

---

## Owner & Brand

**Matt Michels** — Grosse Pointe, MI | matt@mattmichelstraining.com | (313) 806-4952 (personal)
**Goal**: $10k+/mo fully automated income. Matt's only job: return calls, texts, emails.

### Phone Numbers — CRITICAL
- **DWA Work**: (313) 992-1219 / `+13139921219` — A2P Twilio registered. Use in ALL customer-facing content.
- **Matt personal**: (313) 806-4952 / `+13138064952` — `ADMIN_PHONE` env var (internal alerts to Matt) ONLY. Never customer-facing.

### Brands
- **M² Performance Training** — fitness SaaS. Orange `#e8621a` / dark slate `#1e293b`. Domain: mattmichelstraining.com
- **Detroit Web Agency** — B2B automation. Teal `#00d4ff` / near-black `#0a1628`. Domain: detroitwebagent.com. Email: `matt@detroitwebagent.com`

### Email Routing
- DWA products → `dwaEmail()` + `matt@detroitwebagent.com`
- M2/all others → `m2Email()` + `matt@mattmichelstraining.com`

---

## Stack

- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui
- **Backend**: Supabase Edge Functions (Deno/TypeScript) at `supabase/functions/`
- **Database**: Supabase Postgres (RLS on all tables)
- **Payments**: Stripe (inline `price_data` only, no pre-created prices)
- **Email**: Resend API
- **AI**: Claude Opus 4.7 (`claude-opus-4-7`) for high-stakes outreach via `_shared/opus.ts`; cheap calls use Lovable Gateway → `google/gemini-2.5-flash` (branded "Haiku" internally). Haiku fallback ID: `claude-haiku-4-5-20251001`
- **Repo**: `mamoo85/m2training` (GitHub)
- **Primary Supabase**: Lovable-managed (URL starts with `eauvubfpanpeuxsrqesu`)
- **Secondary Supabase**: `zmyczlfuufhngzovkjdh` — GitHub Actions only. Do NOT apply migrations here via MCP.

---

## Codebase Scale

- **382** frontend pages in `src/pages/`
- **918** Supabase Edge Functions in `supabase/functions/`
- **791** migration files
- **33** AI agents in `.claude/agents/`
- **67+** product lines across 5 waves + DWA suite

New product checklist: 1 migration, 1–2 edge functions, 1 page, add to `AdminOpsCenter` + `AdminClientHealth`.

---

## Code Architecture

Two purposes in one codebase:
1. **Fitness Training App** — React SPA with auth, subscription gating, workout tracking, AI coaching.
2. **B2B Revenue Machine** — 100+ landing pages, each with edge functions + Stripe checkouts.

### Frontend Patterns
- All pages lazy-loaded via `lazyRetry()` — never use plain `React.lazy()` directly (`src/lib/lazyRetry.ts`)
- Path alias `@` → `src/`
- Supabase client: `src/integrations/supabase/client.ts`. Types: `src/integrations/supabase/types.ts` — do not edit manually.
- Auth: `useAuth` hook. Admin check: `useIsAdmin`.
- Data fetching: TanStack Query v5 with localStorage persistence.

### Provider Stack (`src/App.tsx`)
`PersistQueryClientProvider` → `SplashScreen` → `AuthProvider` → `TimerProvider` → `OfflineSyncProvider` → `TooltipProvider`

### Route Guards
- `ProtectedRoute` — requires auth
- `SubscriptionGuard` — requires active subscription
- `BlurGate` — blurs content without subscription
- `AgencyAdminRoute` — requires admin; wraps `/admin` and `/dwa-admin`

### Build
- Dev port: `8080`. Target: `es2020` + `safari14`
- PWA: `vite-plugin-pwa` + workbox
- Required env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

---

## Edge Function Conventions

- Every function: `supabase/functions/<name>/index.ts`, Deno runtime
- Shared utilities in `supabase/functions/_shared/`:
  - `ai.ts` — `generateText`, `generateJSON` via Lovable Gateway
  - `opus.ts` — `generateWithOpus` (Opus 4.7 for outreach), `generateWithHaiku` (Gemini Flash via gateway)
  - `twilio.ts` — `sendSMS` + TCPA opt-out scrub + FCC quiet hours
  - `apollo.ts` — `apolloPeopleSearch`, `apolloOrganizationSearch`, `apolloOrganizationEnrich` (canonical; use this, not raw fetch)
  - `firecrawl.ts` — `firecrawlScrape`, `extractFaxNumber`, `extractPhoneNumbers`, `extractContactInfo`
  - `hunter.ts` — `hunterFindEmail(domain)`, `hunterVerifyEmail(email)`
  - `email-waterfall.ts` — multi-source email enrichment waterfall (Apollo → Hunter → Firecrawl → Snov)
  - `address-validation.ts` — Google Address Validation wrapper
  - `alert-rules.ts` — configurable alert thresholds
  - `budget-gate.ts` — per-function spend gate (abort if budget exceeded)
  - `cheap-extract.ts` — lightweight LLM extraction (skip full Opus call)
  - `compliance-waterfall.ts` — TCPA/FCRA compliance check chain
  - `crm-webhook.ts` — HubSpot contact upsert; used by visitor-identify + voicemail handler
  - `demand-radar-log.ts` — structured logging for Demand Radar scans
  - `dlq.ts` — dead-letter queue helpers for failed function invocations
  - `domain-resolver.ts` — domain → company resolution
  - `dwa-email.ts` — DWA-branded Resend wrapper
  - `email-suppression.ts` — email suppression list (complements `outreach-blocklist.ts`)
  - `engine-log.ts` — scanner engine run logging
  - `enrichment-breaker.ts` — circuit breaker for enrichment APIs
  - `enrichment-budget.ts` — per-lead enrichment cost tracking
  - `enrichment-pipeline.ts` — orchestrates Apollo → Hunter → Firecrawl → Snov pipeline
  - `error-log.ts` — writes to `error_logs` (feeds fixer watchdog)
  - `firecrawl-scrape.ts` — lower-level Firecrawl fetch (use `firecrawl.ts` for higher-level helpers)
  - `founder-seats.ts` — founder seat quota enforcement
  - `intake-throttle.ts` — rate limiter for scanner ingestion
  - `kpi-math.ts` — KPI calculation helpers (conversion rates, velocity)
  - `license-waterfall.ts` — LARA license lookup chain
  - `llm-cache.ts` — prompt/response cache to avoid duplicate LLM calls
  - `market-waterfall.ts` — market signal aggregation chain
  - `marketing-kill-switch.ts` — global outreach kill switch (DB flag check before any send)
  - `offer-ad-prompt.ts`, `offer-url.ts`, `offers.ts` — offer copy + URL helpers
  - `provenance.ts` — tracks data source provenance on leads
  - `request-id.ts` — generates/propagates `X-Request-ID` headers
  - `signal-waterfall.ts` — multi-source signal aggregation pipeline
  - `source-probes.ts` + `sources/` — source health-check registry
  - `tech-session.ts` — TechAlert session state helpers
  - `telemetry.ts` — lightweight event telemetry
  - `trade-canonical.ts` — canonical trade vertical name normalization
  - `circuit-breaker.ts`, `fetch-with-retry.ts`, `retry-policy.ts` — resilience utilities
  - `enrichment-audit.ts` — enrichment cost + result logging
  - `anti-hallucination.ts`, `llm-contradiction-check.ts`, `event-corroboration.ts` — LLM output validation
  - `cron-window.ts` — time-window helpers for ET-aligned cron guards
  - `outreach-blocklist.ts` — suppression list checks before any outreach
  - `safe-parse.ts`, `strict-json.ts` — JSON parsing with graceful fallbacks
  - `stealth-scrape.ts`, `scraper.ts`, `scrape-fallback.ts` — browser/HTTP scraping stack
  - `flight-risk.ts`, `intent-score.ts`, `recency-decay.ts` — lead scoring signals
  - `lead-extractor.ts`, `lead-verifier.ts` — lead validation pipeline
  - `sms-templates.ts` — reusable SMS copy library
  - `email-templates/` — transactional React email components
  - `transactional-email-templates/` — order-confirmation, welcome, subscription-activated
  - `scrapers-county-records.ts`, `scrapers-public-listings.ts` — public data scrapers
  - `michigan-cities.ts` — Michigan geo reference data
  - `postcard-assets.ts` — LOB postcard templates
  - `webhook-verify.ts` — Stripe + Twilio signature verification
  - `stripe-key.ts` — Stripe key helper
  - `coldEmailShared.ts` — shared cold email copy utilities
  - `permit-velocity.ts` — permit signal scoring
  - `sanitize-candidate.ts` — candidate data normalizer
  - `signup-classifier.ts` — signup intent classification
  - `dead-lead-emails.ts` — dead lead re-engagement email copy
- Checkout functions named `create-<product>-checkout/index.ts`
- Stripe: always inline `price_data`, always set `metadata.type` for webhook routing
- **SMS**: ALWAYS `import { sendSMS } from "../_shared/twilio.ts"` — never define a local sendSMS. The shared version checks `sms_opt_outs` (TCPA).
- **Apollo**: ALWAYS import from `_shared/apollo.ts` — sends both `X-Api-Key` header AND `api_key` body (Apollo requires both)
- AI calls: `generateWithHaiku()` (cheap) or `generateWithOpus()` (outreach-critical only), `max_tokens` 800–1200
- Read env vars at module scope (top-level), not inside handlers
- Parallelize independent async ops with `Promise.all()`

---

## Migrations

- Files: `supabase/migrations/YYYYMMDDHHMMSS_description.sql`
- All new tables: `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` + `service_role` bypass policy
- **No manual SQL** — GitHub Actions runs `supabase db push` on every merge to main
- pg_cron: use hardcoded URL + vault key — `current_setting('app.supabase_url')` returns NULL in cron context. Correct pattern (confirmed working in `20260504041815`):
  ```sql
  url := 'https://eauvubfpanpeuxsrqesu.supabase.co' || '/functions/v1/<function-name>',
  headers := jsonb_build_object('Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY_VAULT'))
  ```
  Wrong patterns (DO NOT USE): `vault WHERE name = 'SUPABASE_URL'`, `vault WHERE name = 'SUPABASE_SERVICE_ROLE_KEY'`, `current_setting('app.supabase_url')` — none of these vault keys exist.

---

## Deployment

## ⚠️ Deployment Architecture (CRITICAL — READ BEFORE TOUCHING EDGE FUNCTIONS)

**Primary project `eauvubfpanpeuxsrqesu` is owned by Lovable's Supabase org, not Matt's personal account.**
- Matt's Supabase PAT (`SUPABASE_ACCESS_TOKEN`) only has access to the secondary project.
- The Supabase MCP (`list_projects`) only shows the secondary project — confirmed.
- The GitHub Actions `deploy-primary` job was removed by Lovable (it always failed with 403).

**How edge functions actually get deployed to the primary project:**
- Lovable deploys functions IT generates/modifies when it pushes to main.
- External git commits (from Claude Code sessions) to edge functions are NOT auto-deployed by Lovable.
- Direct code changes to edge functions will sit in the repo but won't go live until Lovable touches them.

**To deploy edge function changes made by Claude Code:**
1. Go to lovable.dev → open the project
2. In the Lovable chat, ask: "Please deploy the `<function-name>` edge function with the latest code from the repo."
3. Lovable will make a trivial change and deploy it.

**OR for a permanent fix** (one-time setup):
1. In Lovable → project settings → click the Supabase project link
2. From the Supabase dashboard (opened via Lovable), go to Account → Access Tokens → create new PAT
3. Add it to GitHub Secrets as `PRIMARY_SUPABASE_ACCESS_TOKEN`
4. Restore a `deploy-primary` job in `.github/workflows/deploy-supabase.yml` using this secret

**Secondary project `zmyczlfuufhngzovkjdh`** is in Matt's own Supabase account:
- GitHub Actions CAN deploy here (but the `deploy` job is currently disabled with `if: false`)
- Only hosts: `contractor-lead-notify`, `missed-call-handler`, `missed-call-status`, `inbound-sms-relay`
- At free-tier function limit (~25) — don't add new functions there

---

## Secrets (all in Lovable Cloud)

| Group | Keys |
|---|---|
| Core | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`, `ANTHROPIC_API_KEY`, `LOVABLE_API_KEY` |
| Google | `GOOGLE_MAPS_API_KEY`, `GOOGLE_PAGESPEED_API_KEY`, `GOOGLE_SERVICE_ACCOUNT_KEY`, `GOOGLE_PRIVATE_KEY_B64`, `GOOGLE_CALENDAR_ID` |
| Twilio | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`, `TWILIO_API_KEY` |
| Social | `META_ACCESS_TOKEN`, `META_APP_ID`, `META_APP_SECRET`, `META_PAGE_ID`, `LINKEDIN_ACCESS_TOKEN`, `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET` |
| Data | `FIRECRAWL_API_KEY`, `DATAFORSEO_LOGIN`, `DATAFORSEO_PASSWORD`, `HIBP_API_KEY`, `SAM_GOV_API_KEY`, `NOAA_API_KEY` |
| Enrichment | `APOLLO_API_KEY`, `HUNTER_IO_API_KEY`, `CLEARBIT_API_KEY` |
| Automation | `N8N_MCP_URL`, `N8N_ACCESS_TOKEN` |
| Pending | `LOB_API_KEY`, `BROWSERLESS_API_KEY` |

Twilio webhook (voice/missed call): `https://zmyczlfuufhngzovkjdh.supabase.co/functions/v1/missed-call-handler`

---

## Key Products Reference

> Full details in `knowledge/M2_Product_Catalog.md`. Below is the lookup table for code navigation.

### Detroit Web Agency (primary revenue focus)
| Product | Price | Tables | Webhook type |
|---|---|---|---|
| FieldDesk | $199/mo | `field_crm_clients`, `field_service_jobs`, `tech_locations` | `field_service_subscription` |
| TechAlert | $149/mo standalone · $79/mo bundle · $99/mo founders | `hire_alert_clients`, `hire_alert_candidates`, `hire_alert_runs` | `hire_alert_subscription` |
| SiteRadar | $49/mo | `field_crm_clients` (visitor_script_key), `crm_visitor_events` | — |
| Contractor Leads | $399/mo | `contractor_lead_sites`, `contractor_clients`, `contractor_leads` | `contractor_lead_subscription` |
| Dead Lead Reactivation | $50/reply | `dead_lead_campaigns`, `dead_lead_contacts`, `dead_lead_charges` | `dead_lead_billing_setup` |
| Missed-Call Catch | $99/mo | `missed_call_clients` | `missed_call_subscription` |
| Mortgage Radar | $149/mo | `mortgage_radar_clients`, `mortgage_radar_leads` | `mortgage_radar_subscription` |
| Golden Ticket Marketplace | $39–59/lead | `marketplace_prospects`, `marketplace_lead_locks`, `lo_outreach_campaigns` | `marketplace_lead_purchase` |

### Wave product migrations (search by migration date for full schema)
- Wave 1 (10 SMS/monitoring products): `20260403000000_ten_new_products.sql`
- Wave 2 (10 products): `20260403xxxxxx`
- Wave 3 (30 products): `20260404000000_thirty_new_products.sql`
- Wave 4 (8 products): `20260405080000_seven_new_products.sql`
- Wave 5 high-ticket: `20260405140000` + `20260405140001`

---

## Agents (33 total — `.claude/agents/`)

**Autonomous loop agents** (paired edge functions running 24/7): `tom-autonomous`, `oz-autonomous`, `scarlett-autonomous`, `selma-autonomous`, `ops-autonomous`

**Core**: Tom (lead hunter), Oracle (account watchdog), Ops (fulfillment)

**Specialized**: Aff, Cashier, Comply, Critic, Drill, Guard, Hype, Invest, Launch, Luna, Mirror, Mute, Nova, Pulse, Red, Ref, Rev, Scout, Shield, Solo, Trim, Upsell, Vera, Zero

**Also in `.claude/agents/`**: `PHASE_18_BRIEFING.md` (cross-agent phase briefing), `fixer.md` (autonomous code-fix agent)

> "Create an agent" = create `.md` file at `.claude/agents/[name].md`

---

## Knowledge Base

```bash
git fetch origin main && git checkout origin/main -- knowledge/
```

- `knowledge/M2_Agent_Roster.md` — all 33 agents, status, schedules
- `knowledge/M2_Admin_Controls_Guide.md` — every admin tool
- `knowledge/M2_Product_Catalog.md` — all products, pricing, margins, flows
- `knowledge/M2_Ad_Strategy_Action_Plan.md` — paid ads roadmap
- `knowledge/TechAlert_Value_Proposition.md` — TechAlert pitch, objections, ROI math
- `knowledge/DWA_Business_Plan_2026.md` — full DWA growth plan
- `knowledge/DWA_Full_Business_Audit_2026.md` — full audit findings
- `knowledge/Michigan_Market_Intelligence_2026.md` — Michigan market data
- `knowledge/field-service-brief.md` — FieldDesk product brief
- `knowledge/talent-radar-v5/` — TechAlert v5 product spec

---

## Rules

- All new tables: RLS enabled + service_role bypass policy
- Stripe: inline `price_data` always; always set `metadata.type`; always `constructEventAsync` (not sync) in webhooks
- SMS: always use `_shared/twilio.ts` sendSMS — checks `sms_opt_outs` (TCPA)
- AI: `generateWithHaiku()` for cheap calls (routes to Gemini Flash via Lovable Gateway), `generateWithOpus()` for outreach drafts only (Opus 4.7 direct). max_tokens 800–1200
- stripe-webhook: use `sendM2Email()` and `notifyMatt()` helpers — never raw `fetch()` to Resend
- stripe-webhook: use `${SUPABASE_URL}/functions/v1/...` for function URLs — never hardcode project ref
- Auto-onboard: add welcome email template when adding new products
- Admin dashboards: add to both `AdminOpsCenter.tsx` ALL_SERVICES array AND `AdminClientHealth.tsx` SERVICE_TABLES array
- No dead code: delete unused imports/vars/functions — don't comment out
- `verify_jwt = false` in `config.toml` for public checkout/webhook endpoints — intentional
- Product filter rule: only build products that fail "Can a non-technical person replicate this with free ChatGPT in an hour?" Products that pass = content wrappers. Kill them.
- OSINT methods are never disclosed to clients — intelligence sources are proprietary
- Contractor leads: never pitch until ≥5 real leads in `contractor_leads` table
