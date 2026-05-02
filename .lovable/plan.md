# Wave 5 Plan — Build Order, Bug Defenses, and Claude Hand-Off

**Owner:** Matt Michels · **Date opened:** 2026-05-02 · **Status:** Awaiting "go"

---

## Brother Map (locked — never confuse again)

- **Pat Michels** = DJ Conley = SiteRadar / DJ Conley site customer
  - `pmichels@djconley.com` · (313) 590-4404
  - In DB: `boiler-sector-intel`, `send-djconley-followup-sms`, `AdminMarketingTools`
- **Mitchell Michels** = Mortgage Radar founder seat — **CONFIRMED IN DB:**
  - `mitch.michels@rate.com` · (312) 752-1462 · business: Rate · `is_founder=true` · no Stripe sub · ZIPs: `[01890, 48236, 92407, 96103, 85233]`
  - `mitchellm77@gmail.com` · same person, secondary record · `is_founder=true` · no Stripe sub · same ZIPs
  - **Locked price: $0/mo** (founder seat, both records)
  - **Only paying recipient of Mortgage Radar daily email + SMS besides Matt**
- **Matt** = `matt@detroitwebagent.com` (also a founder row in `mortgage_radar_clients`) + `matt@mattmichelstraining.com` (M2 owner)

These four emails go on the **Founder-Seat Protection list** at `_shared/founder-seats.ts`. Any "expire / mark inactive / cancel / downgrade / upcharge / cold-email" branch in any cron or webhook **must early-exit** when the email matches.

---

## Audit Finding (important)

Phase A and B from my prior plan are **already built and shipping**. I will NOT rebuild them — only verify + patch:
- `/my-addons` page exists (`src/pages/MyAddons.tsx`) + `addon_catalog`, `addon_pitches` tables + `create-addon-checkout` ✅
- Stripe reconciliation: `dwa-v4-stripe-reconcile-diff` + `dwa-v4-retention-sweep` + `client_health_scores` + `upsell_opportunities` + `/dwa-admin/v4` console ✅

So the real new work for me is: brand-integrity fix, founder-seat protection, universal 7-day no-CC trials with magic-link entry, mass cold-outreach engine (email → fax → postcard), and "first reply free" surfacing. **Roofers/12-trades reskin is delegated to Claude — prompt at the bottom of this file.**

---

## Decisions (locked from this conversation)

1. **Mitchell's founder protection:** both emails above, locked price `$0`, only recipient of Mortgage Radar daily email + SMS.
2. **Trial CTA flow:** **Magic-link → straight into the dashboard.** Email gate on landing, magic-link redirects into the trialing dashboard. No password, no Stripe.
3. **Trial length:** 7 days, no credit card, all radars EXCEPT Contractor Leads (we pay for those ads).
4. **Channels in order:** Email → Fax → Postcard. Mass SMS already exists and is TCPA-tight; not adding to this engine.
5. **Geographic scope:** MI first, then any state via DB toggle in `prospector_targets` (table already exists per CLAUDE.md Phase 27 — flip `active=true` for OH/TX/etc, no code deploy).

---

## Build Order

1. **Phase 3 — Brand Integrity Fix** (biggest defensive win, ~1 wave)
2. **Phase 1 — Verify v4 + Founder-Seat Protection** (~½ wave)
3. **Phase 2 — Universal 7-Day No-CC Trials w/ Magic Link** (~1 wave)
4. **Phase 5 — First-Reply-Free Surfacing** (~¼ wave)
5. **Phase 4a-c — Outreach Engine + Email Blaster** (~1.5 waves)
6. **Phase 4d-f — Fax + Postcard + Admin UI** (~1 wave)

Total: 4–5 build waves.

---

## Phase 1 — Verify v4 Retention/Reconciliation + Founder Protection

1. Hit `dwa-v4-stripe-reconcile-diff` once via curl, confirm output covers all 8 DWA products. Patch any product type missing.
2. **New `_shared/founder-seats.ts`** with the 5 emails above (case-insensitive lookup, product-scoped).
3. Wire `isFounderSeat()` early-exit into:
   - `dwa-v4-stripe-reconcile-diff` (skip mismatch flagging)
   - `dwa-v4-retention-sweep` (skip downgrade logic)
   - `trial-lifecycle-orchestrator` (Phase 2 — never expire)
   - `cold-outreach-email-blaster` / fax / postcard (never email a founder)
4. Verify `/my-addons` route is wired in `App.tsx`.

---

## Phase 2 — Universal 7-Day No-CC Trials (Magic-Link Entry)

Eligible: Mortgage Radar, Talent Radar, Growth Radar, Demand Radar, Site Radar, Buyer Radar, Missed-Call Catch, FieldDesk, AI Phone Answering, Reputation Dashboard, Bundle Revenue Suite, Dead Lead Reactivation. **Excluded:** Contractor Leads.

### 2.1 Migration `20260502_radar_trials.sql`
- `radar_trials`: `email citext`, `product`, `name`, `business_name`, `phone`, `trial_started_at default now()`, `trial_ends_at default now()+interval '7 days'`, `magic_token uuid default gen_random_uuid()`, `status` (active/converted/expired/abandoned), `source_campaign`, `converted_at`, `stripe_customer_id`, `unique(email, product)`.
- RLS enabled, service_role bypass.

### 2.2 Edge function `start-radar-trial` (single entry point)
- Body: `{ product, email, name?, phone?, business_name?, source }`
- Validates product against eligible allowlist (rejects `contractor_leads` 400)
- Rate-limit: 3 trials / IP / 24h via `outreach-blocklist.ts`
- Inserts `radar_trials` row + corresponding `*_clients` row with `status='trialing'` and `trial_ends_at = now()+7d`
- Sends DWA-branded magic-link email (uses `_shared/dwa-email.ts` from Phase 3): `https://detroitwebagent.com/trial/{magic_token}`
- Returns `{ magic_url }`
- `verify_jwt = false`

### 2.3 Edge function `redeem-trial-magic-link`
- GET `/redeem-trial-magic-link?token=<uuid>` — validates token, marks `last_login_at`, sets short-lived JWT cookie, 302s to product dashboard.

### 2.4 Edge function `trial-lifecycle-orchestrator` (cron daily 9am ET)
- Day 3: check-in email
- Day 5: conversion email w/ Stripe Checkout deeplink
- Day 6: final reminder
- Day 7+: `status='expired'`, gate dashboard, send reactivation email
- **`isFounderSeat()` early-exit at top of every branch.**
- Skip rows already on a paid Stripe sub.

### 2.5 Landing-page CTAs
Add the magic-link CTA to: MortgageRadar.tsx (alongside existing paid checkout), BuyerRadar.tsx, GrowthRadarDashboard, SiteRadarLanding.tsx, MissedCallCatch.tsx, FieldDesk.tsx, AiPhone.tsx, Reputation.tsx, BundleRevenueSuite.tsx, DeadLeadIntake.tsx. Talent Radar: extend existing `create-hire-alert-trial` from 72h → 7 days, route through `start-radar-trial`. Mortgage Radar paid path **untouched** for Mitchell's founder seat.

---

## Phase 3 — Brand Integrity Fix (M² → DWA Leak)

Most important defensive piece. `stripe-webhook/index.ts` calls `sendM2Email(...)` for ~9 DWA-product callsites — that's why M² Training branding leaks into DWA receipts.

1. **New `_shared/dwa-email.ts`** — exports `dwaEmail(opts)` (HTML template w/ teal `#00d4ff`, near-black `#0a1628`, DWA logo, CAN-SPAM footer w/ Grosse Pointe address) + `sendDwaEmail(to, subject, html, bcc?)`. From: `Detroit Web Agency <matt@detroitwebagent.com>`.
2. **Audit + replace `sendM2Email` callsites** for: Mortgage Radar, Talent Radar, Site Radar, Missed-Call, FieldDesk, Marketplace, Bundle, Dead Lead, Contractor Leads, Dark Web Monitor, SEO Guard, MSP Plan, AI Phone, Reputation. Keep `sendM2Email` ONLY for workout/coach/fitness/exercise/athlete/training-portal flows.
3. **Guardrail Vitest** `src/lib/__tests__/brand-isolation.test.ts`: scans every `supabase/functions/**/index.ts`, fails CI if a known DWA-product handler imports `sendM2Email`. Locks the regression closed.
4. All Phase 4 cold emails MUST use `sendDwaEmail`.

---

## Phase 4 — Unified Mass Cold-Outreach Engine

12 trade verticals: roofers, arborists/tree care, landscapers, plumbers, electricians, HVAC, chimney sweeps, gutter installers, painters, pest control, paving/concrete, garage door.

### 4a. Migration `20260502_mass_outreach_engine.sql`
- `outreach_targets`: `business_name`, `state`, `city`, `trade`, `vertical_tag`, `email`, `email_confidence numeric(3,2)`, `fax`, `phone`, `mailing_address`, `website`, `naics`, `source`, `enrichment_trace jsonb`, `unsubscribed_at`, `bounced_at`, `last_contacted_at`, `state_priority int default 3`, `unique(business_name, state, city)`.
- `outreach_campaigns`: `name`, `product_offering`, `channel` (email/fax/postcard), `target_filter jsonb`, `daily_cap int default 100`, `status text default 'draft'`, counters, `created_by`.
- `outreach_sends` (append-only): `campaign_id`, `target_id`, `channel`, `status`, `provider_id`, `error`, `sent_at`, `replied_at`, `trial_signup_at`, `cost_cents`.
- All RLS service_role-only.

### 4b. `outreach-target-harvester` (cron daily 6am ET)
- Extends `contractor-outreach-statewide-sweep` to all 12 trades, all 83 MI counties via Google Places + DataForSEO Local Pack.
- Multi-state expansion via `prospector_targets.active=true`.
- Email enrichment via existing `_shared/email-waterfall.ts` — every contact gets `enrichment_trace`.

### 4c. `cold-outreach-email-blaster` (priority 1)
- Cron: every 30 min, 8am-7pm ET, M-F.
- Picks targets ordered by `state_priority ASC, email_confidence DESC, random()`.
- Filters: not unsubscribed, not bounced, not contacted in last 90d, has email, passes `outreach-blocklist.ts`, **passes `isFounderSeat()`**.
- Copy via `generateWithOpus` using a **Trial-Pitch template** that ALWAYS:
  - Uses **DWA branding** (`sendDwaEmail`)
  - Says "**7-day free trial — no credit card required**"
  - Single CTA → `https://detroitwebagent.com/{product}/trial?email={prefilled}&campaign={id}` (server calls `start-radar-trial`, returns magic link)
  - One-line OSINT methodology disclosure
  - One-click unsubscribe
  - CAN-SPAM physical address footer
- Logs to `outreach_sends` + existing `email_send_log`.
- Resend daily soft cap: 1500/day.

### 4d. `cold-outreach-fax-blaster` (priority 2)
- Cron: daily 11am ET, 80/day cap. DWA letterhead cover sheet → trial URL + (313) 992-1219. Phaxio integration (already in `channel-prospector`). `cost_cents=7`.

### 4e. `cold-outreach-postcard-blaster` (priority 3)
- Cron: daily 12pm ET, 50/day cap. Front: DWA "7-DAY FREE TRIAL" hero. Back: 3 bullets + QR → trial URL. Geo-batched by ZIP for postage discount via Lob. `cost_cents=85`.

### 4f. Admin UI — DWAAdmin → "📡 Mass Outreach Engine" tab
- Campaigns table (create/pause/resume, filter by state + trade + vertical)
- Live counters (today's sends per channel, trial signups attributed, reply rate, cost-per-trial-signup)
- Target browser (search, see enrichment trace, manual unsubscribe)
- **Brand-integrity widget**: last 50 outbound emails with `From:` address — red flag any `mattmichelstraining.com` send originating from DWA-product code (catches future regressions live)
- State expansion toggle (flip `prospector_targets.active`)

---

## Phase 5 — First-Reply-Free Surfacing for Contractor Leads

1. Audit `dead-lead-drip`, `generate-dead-lead-campaign`, `dead-lead-outreach-drip`, `contractor-drip` — append the first-yes-free copy to drip body + admin preview when parent client is on a Contractor Leads sub.
2. Persistent banner in `AdminDeadLeads` Prospecting Pipeline tab: "Reminder: First YES reply is FREE. Bills $50/reply only after the first."
3. `dead_lead_charges` already handles first-free correctly — this is purely UI/copy clarity.

---

## Defensive Checklist (zero bugs allowed)

1. Run Vitest + Deno tests — no new failures.
2. ≥1 Deno test per new edge function (happy + 1 error).
3. `curl_edge_functions` smoke test on every new function before declaring done.
4. `verify_jwt = false` for any new public-callable function.
5. RLS enabled + explicit service_role bypass on every new table.
6. `isFounderSeat()` early-exit at top of every "expire / downgrade / mark inactive / cold-email" branch.
7. Brand-integrity Vitest from Phase 3 prevents Phase 4 regressions.
8. Idempotency keys on every transactional email send.
9. CAN-SPAM physical address + one-click unsubscribe in every cold email.
10. Rate limit on `start-radar-trial` (3/IP/24h) + email-domain blocklist.
11. **Mitchell-specific guardrail Vitest**: loads `_shared/founder-seats.ts`, asserts both Mitchell emails resolve to `lockedPriceCents=0` and are products-scoped to `mortgage_radar`. Prevents accidental list edits from breaking his free seat.

---

# PROMPT FOR CLAUDE — Mortgage-Radar-Pattern → 12 Trade Radars

> Copy everything between the `===` lines into Claude. He runs in your `mamoo85/m2training` repo with the `.claude/` agent system.

```
=== START PROMPT FOR CLAUDE ===

CONTEXT
You are working in the mamoo85/m2training monorepo on branch `dev`. Read
CLAUDE.md at repo root FIRST — it contains the full session state, brand
rules, secrets list, edge-function conventions, and architecture. Match
all conventions exactly. Owner: Matt Michels — Grosse Pointe, MI. DWA
brand: teal #00d4ff, near-black #0a1628, domain detroitwebagent.com,
sender matt@detroitwebagent.com, work phone (313) 992-1219.

YOUR ASSIGNMENT
Build 12 NEW radar products — one per trade vertical — by REUSING the
Mortgage Radar engine pattern (NOT migrating Mortgage Radar itself).
Each product targets one trade and pitches homeowners-needing-service
leads to that trade's businesses.

VERTICALS (12)
roofers, arborists/tree care, landscapers, plumbers, electricians, HVAC,
chimney sweeps, gutter installers, painters, pest control,
paving/concrete, garage door

WHAT MORTGAGE RADAR ALREADY DOES (DO NOT BREAK, DO NOT MIGRATE)
- 6 deterministic + LLM-validated signal sources (BSEED permits, Zillow
  FSBO, EstateSales.net, court records, SOS LLC filings, NOAA storms)
- Anti-hallucination gate: Google Address Validation + LLM-only leads
  capped at score 3 until 2nd source confirms
- Coordinate-locked Street View
- 5–15 ZIPs per client, daily 8am ET scan
- $399/mo solo, $899/mo team, manual-only outreach (FCRA-clean)
- Founder seat: Mitchell Michels (Matt's brother) on
  mitch.michels@rate.com AND mitchellm77@gmail.com — DO NOT TOUCH OR
  MIGRATE THESE RECORDS. He stays on Mortgage Radar with $0 locked
  pricing as the only paying recipient besides Matt.

PHASE 1 — MARKET RESEARCH (write to .lovable/wave5-vertical-research.md)
For each of the 12 trades deliver one row:
| Vertical | Avg MI deal size | MI annual market $ | Top 3 lead competitors + their CPL | Public trigger signal | Best free + paid data source | Recommended $/mo |

Examples to validate:
- Roofers → recent hail (NOAA Storm Events DB) + age-of-roof from
  permit history (BSEED, county permit portals)
- Arborists → storm damage (NOAA) + tree-removal permits + 311 calls
- Gutter installers → roof permit pulled in last 30d (upsell window)
- Painters → home sale closing in 60d (deed records / MLS)
- HVAC → furnace age >15yr from permit history; heat-wave / cold-snap
  forecasts (NOAA)
- Plumbers → water main breaks (DWSD), winter freeze events
- Electricians → solar/EV-charger/panel-upgrade permits + age-of-home
  + recent sale combo
- Chimney sweeps → woodstove install permits + first frost forecast
- Pest control → seasonal swarm forecasts + new home sales
- Paving/concrete → driveway permits + freeze-thaw cycle data
- Garage door → garage permits + recent home sales

Anchor pricing: Mortgage Radar = $399 solo, but trade deal sizes are
lower so target $99–$299/mo with $0 founder seats reserved.

PHASE 2 — INFRASTRUCTURE
1. New table `trade_radar_clients` (mirrors mortgage_radar_clients +
   `vertical text not null`)
2. New table `trade_radar_leads` (mirrors mortgage_radar_leads + vertical)
3. New `_shared/trade-signals/` with `signals-{vertical}.ts` per trade
4. New edge function `trade-radar-scanner` parameterized by vertical;
   single function, branches on vertical to pick signal modules
5. Cron: daily 8am ET, runs scanner for each active vertical with
   paying clients
6. REUSE the Google Address Validation + coordinate-locked Street View
   + score-cap-at-3-until-corroborated pattern verbatim from Mortgage
   Radar — do not invent new anti-hallucination patterns

PHASE 3 — LANDING + DEMO PAGES
For each vertical:
1. `src/pages/{Vertical}Radar.tsx` — landing with hero, 3-signal
   explainer, ROI calculator, CTA "Start 7-Day Free Trial — No Credit
   Card" → POSTs to `start-radar-trial` (Lovable will have built this;
   if not yet deployed, stub the call with a TODO and ship the page)
2. `src/pages/{Vertical}RadarDemo.tsx` — interactive demo with 3 sample
   leads in nearby ZIPs
3. Routes wired into App.tsx + header nav

PHASE 4 — STRIPE + PROVISIONING
1. `create-trade-radar-checkout` — accepts `vertical` param, prices per
   Phase 1 research, mirrors `create-mortgage-radar-checkout`
2. Add `trade_radar_subscription` handler to
   `supabase/functions/stripe-webhook/index.ts` — upserts
   `trade_radar_clients`, sends DWA-branded welcome via the new
   `_shared/dwa-email.ts` (Lovable will have built this; if not
   present, stub `sendDwaEmail` inline with a TODO)
3. NEVER use `sendM2Email` for these. Brand integrity is critical.

CRITICAL RULES
- DO NOT touch `mortgage_radar_clients`, `mortgage_radar_leads`, or any
  Mortgage Radar function. New verticals are NEW products that share
  the engine pattern — not migrations.
- DO NOT touch records for: mitch.michels@rate.com,
  mitchellm77@gmail.com (Mitchell), pmichels@djconley.com (Pat / DJ
  Conley — different product), matt@detroitwebagent.com,
  matt@mattmichelstraining.com (Matt — owner).
- All new tables: ENABLE ROW LEVEL SECURITY + service_role bypass policy.
- All new edge functions: `verify_jwt = false` in supabase/config.toml
  if publicly callable.
- Use `_shared/twilio.ts` `sendSMS` for any SMS (TCPA-checked).
- AI: `generateWithOpus` for outreach copy, `generateWithHaiku` for
  cheap classification.
- All monetary amounts in cents.
- All cron jobs in ET, with `cron-window.ts` guard.
- No CHECK constraints on `expire_at > now()` — use validation triggers.
- No backend code outside `supabase/functions/`. No Express, Flask, etc.
- Stripe: inline `price_data` only, always set `metadata.type` for
  webhook routing.

WORK ON BRANCH: `wave5-trade-radars` (create it, commit, push, open PR
to main with full vertical-by-vertical breakdown in the PR description).

REPORT BACK with:
1. Full vertical research table from Phase 1
2. Migration filenames + brief schema description
3. List of new edge functions + cron schedules
4. List of new pages + routes
5. Total LOC + estimated build time
6. Any blockers, assumptions made, or coordination points needed with
   the Lovable agent

=== END PROMPT FOR CLAUDE ===
```

---

## What I Need From You Before Starting

Just say **"go"** and I'll start with Phase 3 (brand integrity), then Phase 1 (founder protection), then keep marching down the list. Everything I need is now confirmed in the DB or in this plan.

---

## Wave 5 — Build Status (2026-05-02)

### Phase 1 — Founder Protection ✅
- `_shared/founder-seats.ts` shipped — exports `FOUNDER_SEATS`, `isFounder()`, `stripFounders()`.
- Whitelist: matt@detroitwebagent.com, matt@mattmichelstraining.com, matthewmichels4@gmail.com, mitch.michels@rate.com, mitchellm77@gmail.com, pmichels@djconley.com.
- DB confirmed: both Mitchell rows have `is_founder=true`, no Stripe sub. No automated downgrade exists today (sweepers are read-only) — helper is staged for any future churn/billing automation to import.

### Phase 2 — Universal 7-Day No-CC Trials ✅
- Migration: `radar_trials` table (email, product, magic_token, status, expires_at, founder bypass).
- Edge function: `start-radar-trial` — accepts `{email, product, business_name?, phone?, city?, zip_codes?}`, generates 32-byte magic token, 7-day expiry (founders → 100yr), idempotent re-issue if active row exists, sends DWA-branded email with one-click magic-link button into `/my-<product>?trial=<token>`.
- 8 supported products: mortgage_radar, techalert, site_radar, contractor_leads, missed_call, industry_pulse, fielddesk, bundle_revenue_suite.
- Public (verify_jwt=false). **Lovable UI todo: trial CTA on each radar landing page → POST to `start-radar-trial` → "check your email" thank-you.**

### Phase 3 — Brand Integrity ✅
- New `_shared/dwa-email.ts`: `dwaEmail({to, subject, html})`, `dwaWrap(inner, {ctaText, ctaUrl})`, brand constants.
- Inside `stripe-webhook/index.ts`: new `dwaEmailHtml()` template wrapper (teal #00d4ff / dark #0a1628).
- All 6 DWA-product brand leaks fixed:
  - À la carte lead win → dwaEmail
  - À la carte refund → dwaEmail
  - First Look subscription → dwaEmail
  - Dark Web Monitor welcome → dwaEmail + dwaEmailHtml
  - SEO Guard welcome → dwaEmail + dwaEmailHtml
  - Dark Web Monitor MSP welcome → dwaEmail + dwaEmailHtml
- Remaining `sendM2Email` calls (line 105 helper definition + line 2711 catch-all for unknown `meta.type`) intentionally kept on M2 brand — catch-all is a true unknown fallback.

### Phase 4 — Outreach Engine ✅ (foundations)
- Migration: `outreach_targets`, `outreach_campaigns`, `outreach_sends`. De-dupe by email/phone, opt-out tracking (is_dnc, do_not_email, do_not_fax, do_not_mail), founder bypass column, vertical+state indexed.
- `outreach-email-blast/index.ts` — drains active email campaigns up to `daily_send_cap`, skips founders/DNC/already-sent, personalizes via `{{first_name}} {{business_name}} {{vertical}} {{city}} {{cta_url}}`, 1.5s throttle, sends through `dwaEmail` + `dwaWrap`.
- `outreach-fax-blast/index.ts` — same pattern via Phaxio (~$0.07/page). **Returns 503 until Matt adds `PHAXIO_API_KEY` + `PHAXIO_API_SECRET` to Supabase secrets** — clear error message, no silent failures.
- Postcard blaster (Lob) deferred until Matt adds `LOB_API_KEY` (already pending per CLAUDE.md).
- Cron schedules for blasters intentionally NOT auto-created — Matt should run a campaign manually from `/dwa-admin/outreach` first to QA copy + opt-out flow before automating.

### Phase 5 — First-Reply-Free Surfacing ✅
- `AdminDeadLeads` header now reads: "→ **1st positive reply FREE**, then $50 per YES reply." (was: "$50 per YES reply").
- Customer-facing `FreeBoostCard` already covers this on the contractor dashboard.

### Open Items (for next wave)
1. **Lovable UI to build:** trial CTA blocks on radar landing pages (mortgage-radar, techalert, etc) that POST to `start-radar-trial`.
2. **Lovable UI to build:** `/dwa-admin/outreach` console — list campaigns, create new, view sends, opt-out manager.
3. **Magic-link landing handler:** the existing `/my-*` dashboards need a small `?trial=<token>` reader that calls a `claim-trial-magic-link` function (TODO) to mint a Supabase session.
4. **Secrets needed in Supabase:** `PHAXIO_API_KEY`, `PHAXIO_API_SECRET`, `LOB_API_KEY` (postcards).

---

## Claude Hand-Off Prompt — 12-Trade Vertical Reskin (copy block below)

> **Context:** This is the Detroit Web Agency (DWA) codebase. Lovable AI is owner-side. Mortgage Radar is the existing flagship — a Postgres-backed lead-finder that scrapes BSEED permits, court records, FSBO listings, and equity data, scores prospects, and notifies clients via SMS + daily digest email.
>
> **Your mission:** Adapt the Mortgage Radar engine — DO NOT MODIFY THE EXISTING MORTGAGE RADAR CODE — into 12 sister verticals so DWA can sell similar lead-finding products to other Michigan trades on a 7-day free trial (no credit card, magic-link entry).
>
> **Verticals to target (in priority order):**
> 1. Roofers — storm damage, BSEED roofing permits, insurance claims
> 2. Plumbers — emergency-service signals, water-main breaks, code violations
> 3. Electricians — solar permits, panel upgrades, code violations
> 4. HVAC contractors — heat-wave / cold-snap demand, age-of-system signals
> 5. Arborists — storm damage, EAB infestation, city tree-removal permits
> 6. Painters — for-sale-soon listings, exterior weathering signals
> 7. Concrete / masonry — sidewalk repair permits, foundation inspections
> 8. Landscapers — new-build closings, HOA listings
> 9. Window installers — energy-rebate program enrollees, age-of-home
> 10. Insulation contractors — winter heating-cost spikes, federal rebate claims
> 11. Garage-door installers — break-in reports, age-of-home
> 12. Fence installers — new-pet-license filings, new-baby filings, divorce filings
>
> **Hard constraints:**
> - Do **not** touch any file matching `mortgage_radar*` or `mortgage-radar-*`. Build sister products in parallel.
> - All 12 share one shared scanner orchestrator + one shared scoring/scrubbing pipeline. Each vertical only differs in (a) signal sources, (b) scoring weights, (c) outreach copy.
> - All sister products must be sellable through the existing `start-radar-trial` edge function — register each new product key in `PRODUCT_CONFIG` map (`supabase/functions/start-radar-trial/index.ts`).
> - Geographic targeting: use the existing `prospector_targets` DB table (per CLAUDE.md Phase 27) — toggle `active=true` for any state/city to expand. Default to MI.
> - Brand: ALWAYS use `_shared/dwa-email.ts` (`dwaEmail()` / `dwaWrap()`). NEVER use `sendM2Email` or `m2Email()`. Teal `#00d4ff`, dark `#0a1628`, sender `matt@detroitwebagent.com`, phone `(313) 992-1219`.
> - Founder seats from `_shared/founder-seats.ts` MUST be excluded from any cold outreach.
> - Compliance: TCPA quiet hours (8am–9pm local), no credit-bureau data (H.R. 2808), Manual-Only outbound calls, OSINT methods never disclosed to clients. Use `_shared/twilio.ts` `sendSMS` for any SMS — never raw fetch (it bakes in opt-out scrub + quiet hours).
> - Data validation: every signal source must run through `_shared/anti-hallucination.ts` + `_shared/llm-contradiction-check.ts` + `_shared/event-corroboration.ts` before a lead is written. Mortgage Radar lessons (per `mem://tech/mortgage-radar-anti-hallucination`) apply.
>
> **What I (Lovable) have already built that you should USE:**
> - `outreach_targets` + `outreach_campaigns` + `outreach_sends` tables (mass cold email/fax/postcard).
> - `outreach-email-blast` edge function (drains email campaigns, skips founders/DNC, personalizes templates).
> - `outreach-fax-blast` edge function (Phaxio — needs PHAXIO_API_KEY).
> - `start-radar-trial` edge function (universal 7-day no-CC trial with magic-link, founder bypass).
> - `radar_trials` table for trial tracking.
> - `_shared/dwa-email.ts`, `_shared/founder-seats.ts`.
>
> **Your specific deliverables:**
> 1. **Market research first** (Sonar / Apollo / public BSEED data): for each of the 12 verticals, document the top 3-5 OSINT signal sources Matt can use to find motivated buyers in MI. Save findings to `knowledge/12_Trade_Signal_Sources.md`.
> 2. **Scanner skeleton:** one shared orchestrator function `trade-radar-scanner` that takes `{vertical}` and dispatches to per-vertical signal modules in `supabase/functions/_shared/trade-signals/<vertical>.ts`. All 12 modules implement the same interface: `async function scan(state, city): Promise<TradeLead[]>`.
> 3. **Lead scoring:** shared `_shared/trade-lead-score.ts` — 0–10 scale, vertical-specific weights from a config map.
> 4. **Per-vertical landing pages:** Lovable owns the actual React pages. You produce a one-page brief per vertical (`knowledge/landing-pages/<vertical>-brief.md`) with: pitch (1 paragraph), 3 bullet pain points, 3 sample lead types we'll show, the trial CTA wording, and the trade-specific objection handler.
> 5. **Outreach copy:** for each vertical produce:
>    - 1 cold email template (200 words, Matt's voice — "Hey ${first_name} — saw you do ${vertical} in ${city}. We built a tool that…")
>    - 1 fax cover sheet (single page, big headline + 5 bullets + CTA URL + phone)
>    - 1 postcard message (60 words max, big headline)
>    - 3 follow-up SMS templates (TCPA-compliant, includes STOP)
>    - Save all under `knowledge/outreach-templates/<vertical>/`.
> 6. **DB seed migration:** `supabase/migrations/<ts>_trade_outreach_campaigns.sql` — INSERT one draft `outreach_campaigns` row per vertical/channel combo (12 verticals × 3 channels = 36 draft campaigns) with the templates above pre-loaded. Status='draft' so Matt activates manually.
>
> **Workflow:** commit to a feature branch `claude/12-trade-vertical-reskin`, do not push to main, open a PR with a checklist of what you built per vertical. Matt will merge after Lovable QA passes.
>
> **What success looks like:** Matt can flip one campaign per vertical to `status='active'`, the email blaster drains it, and within 24h trial signups start flowing into `radar_trials` for those verticals.
