# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Git Behavior

- **Auto-pull**: Always `git fetch` and `git pull` whenever needed — never ask for permission.
- **Auto-push**: Push commits to the dev branch without asking.
- **Knowledge files**: Always run `git fetch origin main && git checkout origin/main -- knowledge/` at session start.
- **CLAUDE.md updates**: Update "Current Session State" at end of every session. This is the memory between sessions — keep it current.

---

## Current Session State
*Last updated: 2026-05-02*

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

- **328** frontend pages in `src/pages/`
- **859** Supabase Edge Functions in `supabase/functions/`
- **707** migration files
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
  - `email-waterfall.ts` — multi-source email enrichment waterfall (Apollo → Hunter → Firecrawl)
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
- pg_cron: use `vault.decrypted_secrets` pattern for URLs — `current_setting('app.supabase_url')` returns NULL in cron context

---

## Deployment

- Claude commits to dev branch → Matt merges to main → Lovable auto-deploys
- GitHub Actions deploys to secondary project `zmyczlfuufhngzovkjdh` (contractor-lead-notify + missed-call-handler only)
- Secondary project is at free-tier function limit (~25) — don't add new functions there via MCP

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
