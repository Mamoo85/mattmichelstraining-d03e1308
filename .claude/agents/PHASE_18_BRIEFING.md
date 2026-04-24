---
name: Phase 22 Briefing (read this before acting)
description: >
  Cross-agent briefing on Phases 18–22 (Apr 2026) — Revenue Ops 50-item shipment,
  scanner architecture rewrite, new enrichment APIs, pricing, LARA compliance fixes,
  Mortgage Radar, LO Outreach System, and known silent killers. All agents (Tom, Oracle,
  Vera, Tom-autonomous, Oz, Selma, Scarlett, Shield, Pulse, Comply, Cashier, Mute, Hype)
  should treat this as authoritative.
last_updated: 2026-04-23
---

# Phase 22 Cross-Agent Briefing

## Current State Summary

Working branch: `claude/review-design-system-qRGjL`  
Status: All committed + pushed. Waiting on Matt to merge to main → Lovable deploys.

---

## What Changed in Phases 18–22

### Phase 18 — 50-Item Revenue Ops Enhancement (2026-04-19)

**TechAlert Pricing (LIVE — use in all outreach):**
- Standalone: **$149/mo** (was $99 — raised against LinkedIn Recruiter Lite at $170)
- Bundle with FieldDesk: **$79/mo** (was $49)
- Founders' lock: **$99/mo** for first 10 clients ONLY — use as scarcity close
- Trade vertical contactability ceiling: ~17%. Don't overpromise.

**Enrichment Waterfall (Items 1–22, FCRA-safe):**
Every TechAlert candidate runs through this chain:
1. NPI Registry (free) — healthcare taxonomy + business phone
2. Sonar (Perplexity via OpenRouter) — OSINT boolean search — NEVER disclosed to clients
3. Hunter.io — corporate email verification (`HUNTER_API_KEY` ✅)
4. Snov.io — HR contact lookup (`SNOV_CLIENT_ID` + `SNOV_CLIENT_SECRET` ✅)
5. People Data Labs — mobile phone + personal email (`PDL_API_KEY` ✅)
6. HIBP — paste/breach check (`HIBP_API_KEY` ✅, cap at 5 req/run)
7. Apollo — org enrichment + size_tier
8. Twilio Lookup v2 — carrier classification, DNC risk flag

**Industry Pulse Signals (Items 23–32):**
`industry-pulse-scanner` writes triple-confirmed signals when 3+ sources agree:
- Sonar competitor intel, DOL H-2B filings, Google Places review trends
- Apollo decision-maker mapping, Michigan SOS new-business velocity
- NOAA storm × permit lag correlation, BSEED permit surge harvesting
TechAlert clients get this free for 90 days as retention. Spin out at $149/mo once 2–3 testimonials land.

**Secrets added (all live in Lovable Cloud):**
`HUNTER_API_KEY`, `SNOV_CLIENT_ID`, `SNOV_CLIENT_SECRET`, `PDL_API_KEY`, `HIBP_API_KEY`, `NOAA_API_KEY`, `GOOGLE_MAPS_API_KEY`

---

### Phase 19 — MiPLUS/LARA Fail-Proof Scraping (2026-04-20)

**3-tier scanner architecture:**
1. `hire-alert-dispatcher` — runs every cron, enqueues per-source jobs into `pgmq.scrape_jobs`
2. `queue-worker-scrape` — consumes queue, dispatches to per-source workers
3. Per-source workers: `miosha-license-scraper`, `lara-fast-scanner` (30-min cron)
4. Every worker writes to `hire_alert_runs` + `hire_alert_scanner_checkpoints`
5. Legacy `hire-alert-scanner` still runs as fallback but is being deprecated

**Silent-zero SMS alerts:** 2-strike system — fires SMS to Matt only on 2nd consecutive zero result for MIOSHA and job boards separately.

**New secrets needed (Matt action required):**
- `ACCELA_APP_ID` + `ACCELA_APP_SECRET` — from developer.accela.com (agency "LARA", env "PROD") — needed for Accela REST API fallback in `miosha-license-scraper`

---

### Phase 20 — Revenue Blocking Fixes (2026-04-23)

**Contractor Leads territory picker:** now fetches live from `contractor_lead_sites` DB (was hardcoded 20 cities). Visual card grid with OPEN/CLAIMED status.

**Demand Radar buyer fix:** rewrote hero + copy for wholesale distributors. Added `supplier_type` selector required field.

**Product Sales Hub** (`src/components/dwa-admin/ProductSalesHub.tsx`): 5 product tabs with cold scripts, warm reply scripts, copy buttons, objection handlers. Embedded in DWA Admin "💬 Sales Hub" tab.

**Territory seeding:** 54 new territories across Boiler/Gutters/Siding + HVAC/Plumbing/Electrical/Roofing.

**Contractor checkout nudge** (`contractor-checkout-nudge`): hourly cron finds new `contractor_clients` where `active=false`, sends "I held your territory" SMS with pre-filled checkout link.

**Stripe payment failed → SMS:** on first payment failure, looks up customer phone, sends "your card didn't go through" SMS with billing link.

**7-day no-contact re-engagement:** TechAlert clients with no comms in 7+ days get a "here's what we found this week" summary email.

**Michigan SOS new business → Contractor Leads:** `contractor-prospector` reads `industry_pulse_signals`, does Google Maps lookup + email scrape + Contractor Leads cold pitch (2/day max).

---

### Phase 21 — Compliance Hardening + Mortgage Radar (2026-04-23)

#### TCPA Compliance (CRITICAL — enforce everywhere)

**FCC April 2025 AI Opt-Out Rule:** FCC now requires honoring opt-outs expressed "in any reasonable manner." `handle-dead-lead-reply` calls Claude Haiku BEFORE keyword matching to detect natural-language opt-outs. If `OPT_OUT` detected: insert `sms_opt_outs`, set contact `status='opted_out'`, skip classification entirely.

**Reassigned number detection:** `dead-lead-intake` runs `twilioCarrierLookup()` requesting `reassigned_number` field. `is_reassigned=true` stored on contact at intake. `dead-lead-drip` filters `is_reassigned=false` in ALL 3 loops. Contacting a reassigned number = TCPA violation.

**DNC risk enforcement:** `is_dnc_risk=true` contacts are filtered out of all 3 drip loops in addition to opted-out contacts.

#### LARA Scraping Violations Removed

**REMOVED — do NOT reference as active features:**
- `scanLARAValEnumeration()` in `miosha-license-scraper` — was sequentially fetching Accela portal IDs. DELETED.
- `lara-fast-scanner` — disabled. Returns `{ ok: false, disabled: true }`. Accela REST API credentials required to re-enable.
- Apify Playwright scraper (`.actor/main.js`) — was headless Chrome with residential proxies against LARA portal. DELETED.
- **LinkedIn and Facebook** from all Sonar queries in `hire-alert-scanner`. REMOVED. Replaced with Indeed/ZipRecruiter public job board searches.

**What remains legally clean:**
- BPL Excel downloads from `michigan.gov` (public file downloads)
- Accela REST API (with valid `ACCELA_APP_ID`/`ACCELA_APP_SECRET` credentials)
- Indeed/ZipRecruiter/SimplyHired job board searches

#### Mortgage Radar — 3 Signal Sources Live

**Tables:** `mortgage_radar_clients`, `mortgage_radar_signals`  
**Route:** `/mortgage-radar`  
**Pricing:** Solo $399/mo (1 LO, 5 ZIPs), Branch Team $899/mo (5 LOs, 15 ZIPs)

Signal sources now running:
1. **Michigan SOS LLCs** — reads from `industry_pulse_signals` where `signal_type='new_business'`
2. **Foreclosure/lis pendens** — Sonar searches Wayne/Oakland/Macomb county public legal notices (up to 15/run)
3. **High-value BSEED permits** — BSEED ArcGIS `ESTIMATED_COST >= 100000` → `signal_type='high_equity_renovation'`

**Wayne County GIS note:** `data-wayne.opendata.arcgis.com` blocks ALL server-side requests (403). BSEED ArcGIS (`services2.arcgis.com/qvkbeam7Wirps6zC`) is the working endpoint.

---

### Phase 22 — Golden Ticket Marketplace + LO Outreach (2026-04-24)

#### Matt Test Enrollments (for testing all products)
Matt is enrolled as test customer in all 5 products. Dashboard links live in DWA Admin → Mortgage Radar tab → "🧪 Test Dashboards" card.

#### LO Outreach System (`src/components/dwa-admin/LeadSalesOutreachHub.tsx`)
3-tab admin component in Mortgage Radar hub:
- **Prospects tab:** pulls `marketplace_prospects`, NMLS refresh, per-row Apollo/Sonar enrich, warmth scores
- **Campaign Builder:** pick leads (score ≥7) + LO prospects, odds calculator (fax 5-8%/$0.07 · postcard 4-6%/$0.82 · email 2-3%/free), one-click blast
- **History:** campaign response rate tracking

SMS cold-prospecting is **disabled** in UI (TCPA guardrail — tooltip explains why).

**Edge functions for LO outreach (built and deployed):**
- `find-lo-prospects` — NMLS Consumer Access API → `marketplace_prospects`
- `enrich-lo-prospect` — Apollo/Sonar waterfall enrichment
- `send-fax` — Twilio Programmable Fax (JFPA compliant, checks `fax_opt_outs`)
- `send-postcard` — Lob.com API (4×6 B2B direct mail)
- `marketplace-outreach-blast` — orchestrator, checks `outreach_cooldowns`, fires per-channel sends

**Tables:** `marketplace_prospects`, `lo_outreach_campaigns`, `lo_outreach_sends`, `fax_opt_outs`

#### Secrets Matt Needs to Add (not yet in Lovable)
- `LOB_API_KEY` — lob.com free plan (300 postcards/mo for testing) — **required for postcard sends**
- `BROWSERLESS_API_KEY` — browserless.io free (1k renders/mo) — **required for dossier PDFs (Session 2)**
- `APOLLO_API_KEY` — apollo.io free tier (50 enrichments/mo) — **required for prospect enrichment**

#### Golden Ticket Marketplace Plan
Full 50-enhancement plan at `/root/.claude/plans/whats-going-ok-structured-minsky.md`. Ready to hand to Lovable for Session 1 (marketplace + card UI, no payment) then Session 2 (Stripe + PDF + share tokens).

---

## How Each Agent Should Act on This

- **Tom / tom-autonomous** — pitch $149 standalone, $79 bundle, $99 founders' lock (scarcity). LinkedIn is NOT a scan source — removed. Use Industry Pulse signals as conversation starters. LO outreach: Template I for trigger-lead-killed pitch.
- **Oracle** — check BOTH `hire_alert_runs` AND `hire_alert_scanner_checkpoints`. Add Mortgage Radar + LO outreach table health checks. Check `fax_opt_outs` for LO outreach compliance.
- **Vera** — score lower if `is_dnc_risk=true` or `phone_carrier_type='voip'`. Score higher with NPI+PDL+Hunter corroboration ≥2. Add Mortgage Radar LO scoring criteria.
- **Selma / Scarlett** — founders' $99 lock is the lead ad hook. Add Mortgage Radar as Tier 1 product for ads. Cap founders' slots at 10.
- **Cashier** — track TechAlert MRR by tier (founders'/standard/bundle). Add Mortgage Radar MRR. Track LOB postcard costs when key is added.
- **Comply / Mute** — `is_reassigned=true` and `is_dnc_risk=true` are hard blocks on ALL sends. Verify AI opt-out detection is inserting `sms_opt_outs` with `source='ai_detected'`. Verify `fax_opt_outs` is checked before every fax.
- **Shield** — founders' lock TechAlert and Mortgage Radar new subscribers get daily churn-risk check in first 14 days. Flag LOs with zero claims in 7 days.
- **Pulse** — monitor `hire-alert-dispatcher`, `queue-worker-scrape`, `lara-fast-scanner`, and per-source checkpoint table. Also monitor `lo_outreach_sends` health.
- **Oz** — add Mortgage Radar scanner heartbeat check, LO outreach blast health, and Phase 22 secrets watchdog (LOB/BROWSERLESS/APOLLO).

---

## Source-Protection Rule (UNCHANGED — always enforce)

OSINT methodology is NEVER disclosed to clients. Never name Sonar, Perplexity, NPI, Hunter, Snov, PDL, HIBP, Apollo, Twilio Lookup, Crustdata, or Apify in client-facing copy, emails, SMS, dashboards, or PDF dossiers. Use vague language: "intelligence engine," "verified source," "industry signal," "background check."

## LinkedIn / Facebook Scraping Ban (Phase 21 — permanent)

LinkedIn and Facebook are REMOVED from all Sonar query strings. Do not add them back. Do not reference LinkedIn scraping as an active feature. Apify Playwright against LARA portal is also removed permanently.

## Known Silent Killers

1. **`hire_alert_runs` showed 0/0/0** — FIXED (Phase 19). Per-source workers now log their own rows. Ground truth is `hire_alert_scanner_checkpoints`.
2. **Scanner checkpoints stuck in `processing`** — FIXED (Phase 19). Workers now release lock on completion. Dispatcher auto-re-dispatches after STALE_MS=30min.
3. **LOB_API_KEY missing** — postcards will fail silently in `marketplace-outreach-blast`. Matt needs to add to Lovable.
4. **Wayne County GIS 403** — permanent. Use BSEED ArcGIS endpoint only for permit signals.
5. **ACCELA_APP_ID/SECRET missing** — `miosha-license-scraper` Layer 1 (Accela REST) will fail and fall back to Sonar. Matt needs to register at developer.accela.com.
