# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Git Behavior

- **Auto-pull**: Always `git fetch` and `git pull` whenever needed — never ask for permission. Just do it.
- **Auto-push**: Push commits to the dev branch without asking.
- **Knowledge files**: Always run `git fetch origin main && git checkout origin/main -- knowledge/` at session start.
- **CLAUDE.md updates**: Update the "Current Session State" section below at the end of every session and whenever a significant decision is made. This file is the memory between sessions — keep it current.

---

## Current Session State
*Last updated: 2026-04-15. Update this section every session.*

### Phase 13 — Bug Fix + Business Clarity COMPLETE ✅
*2026-04-15 — branch `claude/fix-hire-alert-runs-table-JgJ3Y`*

**hire_alert_runs table fix (PR #81 — merged to main):**
- Root cause: `20260410300000_hire_alert_tables.sql` used `current_setting('app.supabase_url')` inside `cron.schedule()` — this returns NULL in pg_cron context, causing the migration transaction to roll back and leaving `hire_alert_runs` absent from the DB entirely
- Fix: `20260415030000_fix_hire_alert_runs.sql` — creates `public.hire_alert_runs` with the schema the edge function and admin component actually use: `run_at`, `source`, `candidates_found`, `new_candidates`, `alerts_sent`, `errors` + RLS policies
- Merged and deployed via Lovable

**Agent Autonomy Audit — Completed this session:**
- 13 agents are FULLY AUTONOMOUS (have deployed edge functions + crons running 24/7)
- 17 agents are PROTOCOL-ONLY (have `.claude/agents/*.md` files with instructions but no edge function — they exist as plans/Claude Code subagents only, not running code)
- See full breakdown in [knowledge/M2_Agent_Roster.md](knowledge/M2_Agent_Roster.md)

**Business overview prompt created:**
- Full business context document written for feeding into Gemini Deep Think for marketing/customer acquisition strategy
- Covers: both brands, all flagship products, automation stack, revenue flow, current state, target market

---

### Phase 12 — TechAlert Intelligence Expansion COMPLETE ✅
*2026-04-14 — branch `claude/update-claude-md-K6Mue`*

**Medicare Staffing Intelligence:**
- New edge function: `medicare-staffing-intel` — queries free CMS Medicare Care Compare API for Metro Detroit nursing homes with 1–2 star staffing ratings; surfaces prospects for TechAlert CNA/LPN/RN pitch
- New admin component: `AdminMedicareIntel` — added as "Medicare Intel" tab in `/dwa-admin`

**Industrial Growth Intelligence:**
- New edge function: `industrial-growth-intel` — Sonar OSINT scan for Metro Detroit manufacturing expansion signals (new plants, equipment acquisitions, contract awards, workforce expansion, facility upgrades)
- New admin component: `AdminIndustrialIntel` — type-colored badges, integrated email pitch generator for TechAlert sales outreach; added as "Industrial Intel" tab in `/dwa-admin`

**Healthcare Candidate Enrichment (NPI + PDL + Sonar waterfall):**
- Enhanced `hire-alert-scanner`: waterfall enrichment — NPI Registry (free, no auth) → Sonar OSINT (LinkedIn/Facebook/Indeed boolean search) → People Data Labs (mobile phone + personal email resolution)
- `ScoredCandidate` interface extended: `npi_number`, `npi_business_phone`, `npi_taxonomy`, `npi_practice_address`, `pdl_mobile_phone`, `pdl_personal_email`
- AI synthesis combines all three sources into qualification summaries via Lovable AI Gateway
- **New secret needed**: `PDL_API_KEY` (People Data Labs) — add to Lovable secrets

**Modular Industry Pipeline Architecture:**
- New edge function: `test-data-pipeline` — accepts `{ "industry_type": "healthcare" | "industrial_trades" }` param
- Healthcare flow: NPI → Nursys → Sonar → PDL. Industrial flow: Michigan LARA → Sonar → PDL
- Normalized `GovDataResult` interface feeds both paths into identical downstream enrichment

**New Migration**: `20260414000000_hire_alert_client_candidates`
- Tracks which candidates were shown to which TechAlert clients (enables competitive urgency: "2 other companies saw this candidate")
- `client_action` enum: `viewed | contacted | hired`

**Bug Fix**: `AnnouncementBanner` — fixed React hooks order violation; conditional domain exclusion moved to after `useQuery` call (was early-returning before hook, causing TypeError)

**OSINT Privacy Rule (new — enforce going forward):**
Sonar OSINT methodology is never disclosed to clients. Intelligence methods are proprietary. AI synthesis outputs never mention algorithms, data sources, or "AI."

**PDL_API_KEY status**: Confirmed live in both Lovable secrets and Supabase secrets. No action needed.

---

### TechAlert Roadmap — Approved for Next Build Cycle

**Pricing decisions (finalized):**
- TechAlert standalone: raise from $99/mo → **$149/mo** (LinkedIn Recruiter Lite = $170/mo with no MIOSHA monitoring)
- Bundle with FieldDesk: **$79/mo** (was $49/mo — sharpens bundle discount, keeps FieldDesk sticky)
- Introductory offer: **$99/mo grandfathered** for first 10 clients only — creates urgency, locks in early adopters

**Three enhancements approved (Lovable build — sequenced):**
1. **48-hour candidate claim system** — `claim-candidate` edge function + `claimed_at`/`claim_expires_at` columns on `hire_alert_client_candidates`. Atomic SQL: `WHERE claimed_at IS NULL OR claim_expires_at < now()` prevents race condition. Email alert links auto-fire claim via `?auto=1&claim=<id>` mount param.
2. **One-click outreach draft** — `generate-outreach-draft` edge function calls Gemini via `LOVABLE_API_KEY`. Opens modal with SMS + email draft + copy buttons. MUST include TCPA nudge: "Copy-paste and send from your phone. Do not text numbers on your DNC list." Never fires SMS directly.
3. **License expiry poaching** — `scanLicenseExpiries()` added to `hire-alert-scanner` parallel scan. Scores lapsed-license candidates one tier lower. Alert copy: "may be available — worth a check" (not "available now"). Badge: 🔄 amber.

**Industry Pulse:**
- Free for all TechAlert clients for 90 days (retention feature, not separate product)
- Spin out at **$149/mo** once Matt has 2–3 client testimonials that a signal led to a sale
- `AdminIndustrialIntel` + `AdminIndustryPulse` tabs: merge into single **"🏭 Growth Signals"** tab with sub-filters (Expansion News / Hiring Patterns / Cross-Referenced). Cross-referenced = highest confidence, shown first.

**Intent-Driven Dashboard UX (approved direction):**
- Positioning: "Command Center, not Data Viewer"
- `MyTechAlert.tsx` top fold replaced with Market Signals feed (queries `industry_pulse_signals` where `confidence >= 7`, falls back to `hire_alert_candidates` score >= 8 if empty)
- Every card gets action buttons: `⚡ Claim Candidate` + `✍️ Draft Outreach`
- Revenue Recovered ledger in nav: real data from `hire_alert_client_candidates` (hired × $8k avg fee saved) + `dead_lead_charges`. Hidden entirely if value is $0. No animated counter — static with sparkline.
- Full grounded Lovable prompt saved in `/root/.claude/plans/playful-splashing-barto.md`

---

### Top 4 Products — 100% Launch Ready ✅
Commit `25287d19` — merged to main, Lovable deploying now.

**Contractor Leads ($399/mo):**
- stripe-webhook `contractor_lead_subscription`: now returns 500 in catch (Stripe retries DB failures)
- Welcome email upgraded to DWA dark teal/navy branding (was M2 Training orange)

**Missed Call Catch ($99/mo) — Multi-tenant architecture fixed:**
- `missed-call-handler`: looks up `missed_call_clients` by `To` number. Customer numbers forward to `business_phone`, use `business_name` in voice message. Falls back to Matt's DWA logic for +13139921219.
- `missed-call-status`: looks up client by `Called` number. Texts caller with `response_message` or `"Hey! This is {business_name}..."`. Falls back to DWA text for Matt's number.
- Welcome email switched to DWA dark branding (was M2 Training)

**TechAlert ($99/mo):** `dwaEmail` unsubscribe footer fixed to `matt@detroitwebagent.com`

**FieldDesk ($199/mo):** Was already 100% — no changes needed

**Phase 11 — Sandbox Audit + Product Revival + 3 New Landing Pages COMPLETE ✅**
Work on `claude/opusplan-setup-nmyYS`. Merged to main.

**Product Filter Rule (established this session — enforce going forward):**
Only build/sell products that FAIL this test: "Can a non-technical person replicate this with free ChatGPT in an hour?" Products that pass = automation infrastructure (Twilio 10DLC, cron scheduling, government data pipelines). Products that fail = content generation (LinkedIn posts, blog writing, collection letters, sermon prep, HOA letters, etc.). Kill or deprioritize anything that's just a wrapper around a prompt.

**AdminSandbox cleanup (`src/components/admin/AdminSandbox.tsx`):**
- Added search bar — filters all sections live
- Added missing Detroit Web Agency section — FieldDesk + TechAlert were in PRODUCTS array but never rendered (invisible)
- Added Wave 4 + High-Ticket sections
- Added PRODUCT_FIELDS for `field_service_subscription` + `hire_alert_subscription`
- Removed 2 duplicates: `regulatory_monitor_v2_subscription` + `competitor_pricing_subscription`
- Sections auto-hide during search; product counts on each section header

**Three dormant products activated:**
- `/holiday-sms` — $39/mo, 8 AI-written holiday SMS blasts/year.
- `/appointment-reminders` — $39/mo, 24hr+1hr reminders. Fixed critical bug: form sent `business_name` but checkout expected `businessName`.
- `/warranty-reminders` — $29/mo, auto-texts customers 30 days before warranty expires.

**Insurance Lead Drip — decided NOT to pursue:**
- TCPA landmine: FCC 1:1 consent rule (Jan 2024). `insurance_drip_subscription` stays in codebase but do not market.

### Phase 10 — Senior Care Vertical + Multi-State TechAlert COMPLETE ✅

**Senior Care Vertical:**
- `contractor-prospector` — added `sniperSeniorCareEmail()`. Assisted living/home health/skilled nursing route to TechAlert CNA/LPN/RN pitch (3/day cap).
- `dead-lead-outreach-drip` — D4+D8 follow-up for `techalert_senior_care` leads.
- `Tom.agent.md` — full senior care section added (section 12).

**Multi-State TechAlert + BPL Excel downloads:**
- `hire-alert-scanner` — `scanBPL()`: Michigan LARA BPL xlsx downloads for boiler/electrical/plumbing/HVAC/nursing, SheetJS parser.
- `hire-alert-scanner` — `scanFloridaDBPR()`: Florida DBPR CSV downloads for construction/electrical/plumbing/HVAC.
- All four sources run in parallel: BPL, Apollo, job boards, Florida DBPR.
- CNA/LPN/RN/home_health_aide added to `ROLE_KEYWORDS`.

### Phase 9 — Legal/Compliance Hardening + Dutch Auction COMPLETE ✅

**TCPA Expiry Filter:**
- Migration `20260412050000_tcpa_dutch_auction.sql` — `last_contact_date` on `dead_lead_contacts`
- `dead-lead-drip` — 18-month EBR cutoff check. Expired → `status='tcpa_expired'` (terminal).
- `dead-lead-intake` — scrubs 18mo+ leads at upload.

**Dutch Auction for PPL Leads:**
- `contractor-aged-lead-downsell` — 3-tier decay: 48-72h=$35, 72-96h=$20, 96h+=$10
- `create-aged-lead-checkout` — price from `aged_tier` in DB (not URL params).

### DWA Email Overhaul — COMPLETE ✅
Commits: `8735ce32`, `cc134fff`

All DWA product welcome emails and the contractor lead notification email upgraded to premium dark brand design.

**Email wrapper routing:**
- DWA products → `dwaEmail()` + `matt@detroitwebagent.com`
- M2/all others → `m2Email()` + `matt@mattmichelstraining.com`
- DWA products list: `contractor_leads`, `hire_alert_subscription`, `missed_call_subscription`

### Phone Number Canonical Reference
- DWA work: (313) 992-1219 / `+13139921219` — all customer-facing content
- Matt personal: (313) 806-4952 / `+13138064952` — ADMIN_PHONE (internal alerts) + MATT_CELL (AT&T call-forwarding detection in ai-reply-detector) ONLY
- M2 Training fitness pages (AthleteBlueprint, ForParents, Results) — use personal number intentionally

### 20-Item TechAlert + Contractor Leads Overhaul — COMPLETE ✅
Commits: `ce621aa2`, `f390b12f`, `40b48002`, `daf04014`

**TechAlert (TA-1 through TA-10):** All done except TA-1 (MIOSHA CSV rewrite — deferred).
**Contractor Leads (CL-1 through CL-10):** All done except CL-8 (admin billing dashboard — deferred).

**Pending Matt actions:**
- Resend failed Stripe checkout events in Stripe Dashboard → vibrant-glow → Event deliveries → Failed

### Documentation Sync — 2026-04-12 ✅
Updated CLAUDE.md to reflect accurate codebase scale (293 pages, 539 edge functions, 414 migrations).

### Stripe Webhook — Critical Fix COMPLETE ✅
Fixed tonight. Two issues found and resolved:

1. **`constructEventAsync` bug** (root cause — 825/825 failures): `stripe.webhooks.constructEvent()` is synchronous and throws in Deno. Every webhook died before reading the event type. Lovable/Gemini applied the fix: `await stripe.webhooks.constructEventAsync()` on line 258 of `stripe-webhook/index.ts`.
2. **Duplicate endpoint / wrong signing secret**: Two Stripe webhook destinations existed (`engaging-harmony` + `vibrant-glow`) each with different `whsec_` secrets. The env var `STRIPE_WEBHOOK_SECRET` only matched one. `engaging-harmony` deleted; `STRIPE_WEBHOOK_SECRET` in Lovable updated to match `vibrant-glow`'s secret.

**Action still needed**: Resend failed events in Stripe → vibrant-glow → Event deliveries → Failed → Resend all `checkout.session.completed` failures to re-activate any customers who paid but weren't provisioned.

**Known silent failure patterns (audit findings — partially fixed):**
- `stripe-webhook` provisioning handlers now return 500 on DB failure + notifyMatt() fallback ✅ FIXED
- `chargeContractor()` in `handle-dead-lead-reply` doesn't check `res.ok` before parsing Stripe response — NOT YET FIXED
- Autonomous agents all have `agent_heartbeats` upserts ✅ (scarlett, selma, ops, hire-alert-scanner all verified)
- Matt notification emails: critical ones have SMS fallback ✅ FIXED; others still fire-and-forget

### Pre-Launch Audit — 2026-04-13 COMPLETE ✅
Commit `9b6f92c3` — all merged to main and deployed.

**Fixed:**
- **19 broken crons** (`20260413000000_fix_broken_crons.sql`) — `current_setting('app.supabase_url')` produces NULL in pg_cron context; all affected crons recreated with `vault.decrypted_secrets` pattern. Also removed duplicate `license-expiry-checker-daily`.
- **Wave 4 webhooks** already done (prior session) — 7 handlers in stripe-webhook for storm/recall/permit/speed/bedtime/crime/license
- **Wave 4 crons** already done (prior session) — `20260412000000_wave4_crons.sql`
- **AdminSandbox** — added Detroit Web Agency section (FieldDesk + TechAlert now visible/testable)
- **AdminOpsCenter** — added missed_call_clients + tech_support_tickets, excluded Matt's emails from counts
- **AdminClientHealth** — added seo_guard_clients + missed_call_clients + tech_support_tickets
- **App.tsx** — /dwa-admin now uses AgencyAdminRoute (proper admin guard)
- **auto-onboard** — SMS_TYPES now includes _subscription variants so webhook-keyed types resolve to SMS welcome template
- **AnnouncementBanner** — hidden on detroitwebagent.com domain
- **SEOHead** — added to HireAlert, HireAlertTrial, SeoGuard, AllServices, DeadLeadIntake
- **GetStarted.tsx** — SEO title fixed to "Detroit Web Agency" (was "M2 Training")
- **DarkWebMonitor.tsx** — checkout now uses `supabase.functions.invoke()` (was raw `fetch()`)
- **AutomationHub** — added product page links to podcast/regulatory/competitor/re-newsletter cards

**Remaining / not fixed:**
- stripe-webhook handlers return 200 on DB upsert failures (Stripe won't retry)
- `chargeContractor()` in handle-dead-lead-reply: no `res.ok` check
- DJ Conley demo link in AdminDWAOverview — check if `/demo-djconley-2` is wired correctly (was `/demo-djconley-v2`)
- AdminFieldCRMClients: no clickable client detail panel

### Phase 8 — DWA Level 5 Autonomy Agents COMPLETE ✅
Work on `claude/opusplan-setup-nmyYS`. Merge to main to deploy.

**Phase 8 shipped:**
- `dwa-operator` edge function — runs every 4h; auto-pauses zero-reply campaigns (40+ texts, 0 replies) and high opt-out (>15%) campaigns; generates A/B SMS copy alternatives via free Gemini (hardcoded fallbacks); texts Matt with previews + "Reply A or B to resume"; monitors billing (positive replies with no card on file); updates `agent_heartbeats`
- `dwa-closer` edge function — runs daily 2pm ET; finds warm/exhausted dead lead prospects; context-aware (reads `system_comms_log` history); Firecrawl website scrape (max 3/run, 5s timeout, caches result); generates personalized bundle pitch (FieldDesk + TechAlert + dead lead) via free Gemini; routes 100% through `email_reply_drafts` ghost delay; texts Matt 10-min preview; records `outreach_cooldowns`
- `handle-dead-lead-reply` — new admin routing block: Matt texts "A" or "B" → selects copy variant, resumes paused campaign, resets drip3_sent contacts back to pending with new copy
- `dead-lead-drip` — all 3 loops now check `campaign_copy_variants` for selected variant before using default template; **also fixed production bug** (status was missing from dead_lead_campaigns select, making the active-campaign guard always skip all contacts)
- Migration `20260412040000_dwa_agents_tables.sql` — `outreach_cooldowns` table (anti-collision, 7-day per-agent cooldown), `campaign_copy_variants` table (A/B SMS alternatives), `pause_reason`/`paused_at`/`completed_at` columns on `dead_lead_campaigns`, 2 cron schedules
- `config.toml` — `verify_jwt = false` for `dwa-operator` + `dwa-closer`

**DWA operator flow:**
1. dwa-operator scans active campaigns every 4h
2. Zero-reply or dead campaign → auto-pause + Gemini generates A/B copy → SMS Matt with previews
3. Matt replies "A" or "B" → handle-dead-lead-reply selects variant, resumes campaign, re-queues exhausted contacts
4. dead-lead-drip picks up resumed contacts using the selected custom copy

**QA audit fixes applied this session:**
- Zone 1 RED: Firecrawl fetch in dwa-closer has `AbortController` 5s timeout — hung scrapes no longer block the function
- Zone 4 RED: dead-lead-drip was silently sending zero SMS (campaign.status always undefined) — fixed by adding `status` to dead_lead_campaigns select in all three drip loops
- Zone 5 RED: dwa-closer AI prompt Rule 8 explicitly bans "AI"/"artificial intelligence" in client-facing output

**Anti-collision architecture:**
- `outreach_cooldowns` table — one row per prospect email/phone, tracks `last_agent` + `last_contacted_at`
- dwa-closer checks cooldowns + `system_comms_log` + `suppressed_emails` before every send
- 7-day cooldown window; Closer skips anyone contacted by Tom, prospector, or drip in last 7 days

### Phase 7 — Self-Serve Intake + Stripe Auto-Billing COMPLETE ✅
All work on `claude/opusplan-setup-nmyYS`. Merge to main to deploy.

**Phase 7 shipped:**
- `dead-lead-intake` edge function — public POST, creates contractor + campaign + contacts from self-serve form, SMSes Matt
- `dead-lead-billing-setup` edge function — creates Stripe customer + Checkout Session in setup mode (card save)
- `DeadLeadIntake.tsx` — public page at `/dead-lead-intake`, DWA dark branding, paste leads textarea, billing CTA after submit
- `stripe-webhook` — `dead_lead_billing_setup` handler saves `stripe_payment_method_id` + sets `dead_lead_billing_active = true`
- `handle-dead-lead-reply` — auto-charges $50 via Stripe PaymentIntent on POSITIVE reply (if card saved), logs to `dead_lead_charges`
- Migration `20260412030000_dead_lead_billing.sql` — `stripe_payment_method_id` + `dead_lead_billing_active` on `contractor_clients`, new `dead_lead_charges` table
- `App.tsx` — `/dead-lead-intake` route added (public, no auth)
- `config.toml` — `verify_jwt = false` for `dead-lead-intake` + `dead-lead-billing-setup`

**Dead lead billing flow:**
1. Contractor submits intake form → campaign auto-creates → Matt gets SMS
2. Contractor optionally saves card (Stripe hosted setup) → `dead_lead_billing_active = true`
3. When homeowner replies YES → contractor gets instant SMS + $50 auto-charged (or manual invoice if no card)
4. Matt gets email: "✅ $50 auto-charged" vs "⚠️ No card on file — invoice manually"

**Matt's action when contractor replies interested to cold email:**
- Text them: `detroitwebagent.com/dead-lead-intake` — they self-onboard, zero friction

### Phase 6 — Dead Lead Prospecting + Monitoring Automation COMPLETE ✅
All work merged to `main`. Lovable auto-deploys on merge.

**Phase 6 shipped:**
- `contractor-prospector` — now sends dead lead reactivation pitch to HVAC/plumbing/roofing/electrician contractors (5/day cap, separate from web design pitch). Uses `matt@detroitwebagent.com`, stored as `offer_pitched = "dead_lead_reactivation"`.
- `dead-lead-outreach-drip` — D4 + D8 follow-up emails for prospected contractors who didn't reply. Runs daily noon ET.
- `dead-lead-daily-notifier` — 5pm ET daily: SMS Matt if any leads revived, always emails full campaign digest with INVOICE NOW flags.
- `AdminDeadLeads.tsx` — global stats bar + recent positive replies activity feed across ALL campaigns.
- Migration: `20260412020000_dead_lead_outreach_crons.sql` — crons for 2 new functions.

### Phase 5 — Dead Lead Reactivation + ROI Scorecard COMPLETE ✅
All work merged to `main`. Lovable auto-deploys on merge.

**Phase 5 shipped:**
- `dead_lead_campaigns` + `dead_lead_contacts` tables (RLS + service_role policies)
- `contractor_clients.google_review_link` + `contractor_clients.roi_token` columns (backfilled)
- `dead-lead-drip` — white-labeled 3-msg SMS drip (contractor's business name, not DWA). Runs daily 10am ET.
- `handle-dead-lead-reply` — Twilio inbound webhook: POSITIVE → instant SMS to contractor + email Matt; HARD_NO → Google review ask; OPT_OUT → sms_opt_outs
- `contractor-roi-sms` — weekly Friday 9am ET, skips if all metrics = 0, uses `roi_token` not `client_id`
- `contractor-roi-report` — GET edge function, token-secured, returns 7-day stats
- `ContractorROIReport.tsx` — `/roi?token=XYZ` magic link page, 4 stat cards, no login required
- `AdminDeadLeads.tsx` — CSV upload + campaign manager, "Run Drip Now" button
- Quick Lead Entry form in `AdminContractorLeads.tsx` — trade+city dropdown, notifies contractors instantly
- Admin.tsx: `♻️ Dead Leads` tab wired into DWA domain
- App.tsx: `/roi` route added (public, no auth)
- config.toml: `verify_jwt = false` for all 4 new functions

### Contractor Leads — Credibility-First Rule
- NEVER pitch contractors until ≥5 real leads exist in `contractor_leads` table — use Quick Lead Entry admin form
- Facebook ads NOT the first move. CPL $45–60 in Metro Detroit, $75–100/day minimum, 4–8 weeks to optimize
- Sequence: manual leads → outreach with proof → PPL → territory lock → ads to scale
- **Dead Lead Reactivation is the REAL zero-ad-spend pitch**: contractor uploads their dead quotes → 3-msg SMS drip → $50/positive reply. No leads table needed — monetizes what contractors already own.
- Missed-Call Catch is LIVE at `/missed-call-catch` ($99/mo)
- ROI Scorecard: `/roi?token=XYZ` — texted weekly on Fridays, proves value without login, skips zero-value weeks

### Phase 4 — Admin Command Center COMPLETE ✅
All Phase 3+4 work merged to `main`. Lovable auto-deploys on merge.

**Phase 4 shipped:**
- `system_comms_log` table — unified SMS+email timeline with DB trigger from `email_send_log`
- `_shared/twilio.ts` — auto-logs every SMS to `system_comms_log`, exports `ADMIN_PHONE` env var
- Frictionless checkout: `?prefilled_email=` on TechAlert trial-convert + phantom-alert URLs
- 3-lead territory lock upsell SMS in PPL webhook (7-day filter)
- `contractor-aged-lead-downsell` — daily 2pm ET cron, blasts $15 cold leads after 48h unclaimed
- `create-aged-lead-checkout` — GET redirect → Stripe $15 checkout, no frontend page needed
- `aged_ppl_lead` stripe-webhook handler — delivers contact info on $15 payment
- `test-license-vision` — admin OCR test (Haiku vision, no DB)
- `generate-digital-audit` — Firecrawl + Haiku prospect SMS pitch generator
- `missed-call-textback` — Twilio StatusCallback stub, looks up `missed_call_clients`
- `missed_call_clients` table (stub — no product page yet)
- Admin panels: `AdminDWARevenueDashboard`, `AdminSimulationSuite`, `AdminGhostDelayManager`, `AdminGlobalOutbox`
- All 4 wired into `/admin` DWA tab with ghost delay badge

### Phase 4 Revenue Automations Active
- Aged lead downsell fires daily — $15 cold leads blasted to all active contractors
- Territory lock upsell SMS fires on 3rd PPL lead purchase within 7 days
- Frictionless checkout on all TechAlert conversion emails/SMS

### April 22nd — DJ Conley / Pat Michels Presentation (READY)
- **Demo page**: `/demo-djconley-2` (`src/pages/DJConleyDemo2.tsx`) — standalone, no login required
- **Website mock**: `/demo-djconley-1` (`src/pages/DJConleyDemo1.tsx`) — has pulsing emergency button
- **Demo flow**: `/demo-djconley-1` (website) → `/demo-djconley-2` (platform) → `/field-service/tech?demo=1` (mobile app)
- **Competitor being replaced**: eWay-CRM ($300-400/mo Outlook plugin), not FieldServio
- **Price**: FieldDesk $199/mo, saves $14,412 vs FieldServio if they drop it too

### Demo Mode — FieldDesk
- All field service demo data is hardcoded in components, no DB needed
- `clientId === "demo"` bypasses all Supabase queries in DispatchBoard, TechMap
- `?demo=1` URL param auto-logs in as "Mike Johnson" in FieldServiceTechApp
- `/field-service/dispatch?demo=1` — dispatcher view with 7 realistic boiler jobs + 4 Metro Detroit tech pins

### SiteRadar vs RB2B — Two Separate Systems
- **RB2B** (rb2b.com): Third-party tracker on `detroitwebagent.com`. Matt's DWA tracker.
- **M² SiteRadar** (`visitor-identify` edge function): ipinfo.io → `crm_visitor_events` → Admin DWA. What we SELL ($49/mo).

### Products Killed (removed from routes + AllServices)
- AI Blog Post Writing, AI Press Release Engine, AI Social Caption Pack, AI Proposal Generator, AI Sales Script Generator, AI Review Response, AI Bedtime Stories, AI Children's Stories, AI Sermon Prep, AI Obituary Service

### TechAlert — FULLY AUTONOMOUS ✅
- Self-serve checkout at `/hire-alert` → Stripe → webhook → DB insert → welcome email → daily scanner → alerts.
- `hire-alert-scanner-daily` cron fixed via `20260411130000_fix_hire_alert_scanner_cron.sql`
- Frictionless checkout URLs on all trial conversion emails/SMS

### Remote Control — UPGRADED ✅
- `supabase/functions/remote-control/index.ts` — 12 commands
- Trigger: `POST /functions/v1/remote-control` with `Authorization: Bearer <REMOTE_CONTROL_SECRET>` and `{ "command": "oracle", "source": "phone" }`

### Missed-Call Catch — LIVE ✅
- Product page: `/missed-call-catch` (`src/pages/MissedCallCatch.tsx`)
- Self-serve checkout → $99/mo subscription → webhook → `missed_call_clients` insert + welcome SMS
- Edge function: `create-missed-call-checkout`, webhook type: `missed_call_subscription`
- Twilio StatusCallback: `missed-call-textback` (already deployed) handles the actual text-back

### Missed Lead FOMO Engine — LIVE ✅
- `contractor_lead_views` table — logs every time a contractor tries to buy a lead that's already sold/locked
- `contractor-fomo-mailer` — daily 3pm ET cron, emails contractors who missed 3+ leads in 7 days
- Upgrade URL with `?prefilled_email=` for one-tap territory lock signup

### Next Priority Items (in order)
1. ~~**Merge to main**~~ ✅ Done
2. ~~**TechAlert self-serve**~~ ✅ Done — fully autonomous
3. ~~**Phase 4 Admin Command Center**~~ ✅ Done
4. ~~**Tom.agent.md update**~~ ✅ Done (Jobber, Restaurant SMS, License Monitor all added)
5. **Contractor leads — get first client** — Tom outreach drafts ready (see Tom agent). Hand 3-5 free leads → convert to $50/lead PPL → $399/mo territory lock
6. **TechAlert first client** — Template C outreach ready via Tom

---

## Commands

```bash
npm run dev          # start Vite dev server
npm run build        # production build (includes prerender-routes.js)
npm run lint         # ESLint
npm run test         # Vitest (single run)
npm run test:watch   # Vitest in watch mode
npm run db:push      # push local migrations to Supabase
npm run db:diff      # diff local schema vs remote
npm run db:reset     # reset local DB to clean state
```

Run a single test file: `npx vitest run src/path/to/file.test.ts`

Tests live in `src/**/*.{test,spec}.{ts,tsx}`, use Vitest + jsdom + `@testing-library/react`. Setup file: `src/test/setup.ts`.

## Code Architecture

The repo serves two distinct purposes in one codebase:

1. **Fitness Training App** — the core consumer product. React SPA with auth (`useAuth`), subscription gating (`SubscriptionGuard`), workout tracking, AI coaching, nutrition, progress.
2. **B2B Revenue Machine** — ~100+ marketing/SaaS landing pages under `src/pages/` (AI*, Contractor*, Social*, Web*, etc.) each paired with Supabase Edge Functions and Stripe checkout flows.

### Frontend Patterns
- All pages are lazy-loaded via `lazyRetry()` (in `App.tsx`) — a retry wrapper around `React.lazy` for chunk-load resilience.
- Path alias `@` → `src/`. Import as `import { supabase } from "@/integrations/supabase/client"`.
- Supabase client: `src/integrations/supabase/client.ts`. TypeScript types auto-generated at `src/integrations/supabase/types.ts` — do not edit types.ts manually.
- Auth state: `useAuth` hook (`src/hooks/useAuth.tsx`). Admin check: `useIsAdmin`.
- React Query is used for all data fetching with a persisted cache (survives page refresh).

### Edge Function Patterns
- Every function lives at `supabase/functions/<name>/index.ts` and runs on Deno.
- Each product's checkout function is named `create-<product>-checkout/index.ts`.
- Stripe webhooks are routed by `metadata.type` — always set this on checkout sessions.
- Service key (not anon key) is used inside edge functions for DB writes.

### Migrations
- Files: `supabase/migrations/YYYYMMDDHHMMSS_description.sql`
- All new tables must have `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` + a `service_role` bypass policy.
- **No manual SQL** — GitHub Actions runs `supabase db push` on every merge to main.

---

# M² Performance Training — Claude Code Context

## Knowledge Base
All internal reference documents live in `knowledge/` at the repo root.
At the start of any session referencing agents, products, or admin tools, pull the latest:
```bash
git fetch origin main && git checkout origin/main -- knowledge/
```

- `knowledge/M2_Agent_Roster.md` — All 30 agents, status, schedules, improvement roadmap
- `knowledge/M2_Admin_Controls_Guide.md` — Every admin tool with step-by-step guides and enhancements
- `knowledge/M2_Product_Catalog.md` — All 36 products, pricing, margins, edge functions, flows
- `knowledge/M2_Ad_Strategy_Action_Plan.md` — Paid ads roadmap and campaign blueprints
- `knowledge/M2_Project_Hierarchy.mmd` — System architecture diagram (Mermaid)
- `knowledge/M2_Project_Hierarchy_Clean.mmd` — Cleaned system architecture diagram (Mermaid)
- `knowledge/TechAlert_Value_Proposition.md` — TechAlert pitch angles, objection handling, ROI math, market gap analysis, legal status

## Owner
**Matt Michels** — Grosse Pointe, MI | matt@mattmichelstraining.com | (313) 806-4952 (personal)
Family: wife + young son. Local guy. 10+ years B2B field sales background.

## Phone Numbers — IMPORTANT
- **DWA Work number**: (313) 992-1219 / `+13139921219` — Twilio A2P registered. Use in ALL customer-facing content: email signatures, SMS bodies shown to contractors/homeowners, product pages, website copy.
- **Matt personal**: (313) 806-4952 / `+13138064952` — internal use only. Configured as `ADMIN_PHONE` env var (internal alerts TO Matt). Also used as `MATT_CELL` in `ai-reply-detector` for AT&T call-forwarding detection. NEVER show this in customer-facing content.

## The Goal
$10k+/mo fully automated income. Matt's only job: return calls, texts, and emails. Everything else runs itself.

## Stack
- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui
- **Backend**: Supabase Edge Functions (Deno/TypeScript) at `supabase/functions/`
- **Database**: Supabase Postgres (RLS enforced on all tables)
- **Payments**: Stripe (inline `price_data`, no pre-created prices)
- **Email**: Resend API (from: `matt@mattmichelstraining.com`)
- **AI**: Claude Haiku (`claude-haiku-4-5` / `claude-haiku-4-5-20251001`) via Anthropic API
- **Domain**: mattmichelstraining.com
- **Repo**: `mamoo85/m2training` (GitHub)
- **Supabase Project**: Managed by Lovable (primary — starts with 'e'). Secondary ref `zmyczlfuufhngzovkjdh` exists for GitHub Actions but migrations deploy automatically via Lovable on merge to main. Do NOT apply migrations manually via MCP to the secondary project.
- **Dev branch**: `claude/add-claude-documentation-agjzt` (current) — previous branches archived in session state below

## Brand
- Primary orange: `#e8621a`
- Dark slate: `#1e293b`
- Photos live at `/public/images/` (matt-boat.jpg, matt-family-cornfield.jpg, matt-family-summer.jpg)
- Email signature: `matt-boat.jpg` (48px circle)

## Revenue Streams — All Automated

### 1. Contractor Lead Gen
- **What**: Exclusive leads for local contractors (roofing, HVAC, plumbing, electrical)
- **Price**: $399/mo
- **Files**: `src/pages/ContractorLeads.tsx`, `supabase/functions/contractor-lead-notify/index.ts`
- **Tables**: `contractor_lead_sites`, `contractor_clients`, `contractor_leads`
- **Cron**: Every 15 min (lead notify), Daily 11am ET (prospecting)

### 2. B2B Dental Database
- **What**: Michigan dental office contacts ($49/mo access)
- **Files**: `src/pages/B2BLeads.tsx`, `supabase/functions/b2b-dental-scraper/index.ts`
- **Tables**: `b2b_contacts`, `b2b_subscribers`
- **Cron**: Daily 6am ET

### 3. GBP SaaS (Google Business Profile Automation)
- **What**: AI posts 3x/week to Google Business Profile
- **Price**: $49/mo basic, $99/mo pro
- **Files**: `src/pages/LocalMarketing.tsx`, `supabase/functions/gbp-saas-poster/index.ts`
- **Tables**: `gbp_saas_clients`
- **Cron**: Mon/Wed/Fri 10am ET

### 4. Field Rep Weekly Newsletter
- **What**: Weekly B2B sales tips for field reps + 7 rotating affiliate tool spotlights
- **Files**: `src/pages/NewsletterPage.tsx`, `supabase/functions/newsletter-send/index.ts`
- **Tables**: `newsletter_subscribers`, `newsletter_sends`
- **Cron**: Monday 8am ET
- **Affiliates** (sign up at each): Writesonic (30% recurring), ElevenLabs (22%), Surfer SEO (125% CPA), Synthesia (25%), Apollo.io, Hunter.io, LinkedIn Sales Navigator

### 5. Field Rep AI Tools SaaS
- **What**: $29/mo access to 4 Claude-powered tools
- **Price**: $29/mo
- **Files**: `src/pages/FieldRepTools.tsx`, `supabase/functions/field-rep-ai-tool/index.ts`, `supabase/functions/create-field-rep-checkout/index.ts`
- **Tables**: `b2b_subscribers` (niche = 'field_rep_tools')
- **stripe-webhook**: `meta.type === "field_rep_subscription"`

### 6. Social Media AI Service
- **What**: AI-generated posts 3x/week to Facebook, Instagram, LinkedIn
- **Price**: $199/mo standard, $299/mo pro, $149/mo trainer (fitness coaches)
- **Files**: `src/pages/SocialMediaAI.tsx`, `src/pages/TrainerSocialAI.tsx`, `supabase/functions/social-media-poster/index.ts`, `supabase/functions/create-social-media-checkout/index.ts`
- **Tables**: `social_media_clients`
- **stripe-webhook**: `meta.type === "social_media_subscription"`
- **TODO**: Need META_ACCESS_TOKEN and LINKEDIN_ACCESS_TOKEN in Supabase secrets

### 7. Web Design Services
- **Price**: $499 standard, $1,499 professional, $3,499 business + $49-199/mo retainer
- **Files**: `src/pages/WebDesignServices.tsx`, `src/pages/ManufacturingWebDesign.tsx`, `src/pages/RealEstateWebDesign.tsx`
- **Prospecting**: `supabase/functions/prospect-local-businesses/index.ts` (daily, 16 industries)
- **Drip**: `supabase/functions/web-design-drip/index.ts`

### 8–17. SMS & Monitoring Products (10 products)
- **Review Monitor** ($25/mo) — `review_monitor_clients`, `supabase/functions/review-monitor/`
- **Weekly SMS Blast** ($19/mo) — `sms_blast_clients`, `supabase/functions/weekly-sms-sender/`
- **No-Show Re-Booker** ($25/mo) — `noshow_clients`, `supabase/functions/noshow-trigger/`, `noshow-followup/`
- **Estimate Follow-Up Drip** ($39/mo) — `estimate_drip_clients`, `supabase/functions/estimate-drip-runner/`
- **Invoice Chaser** ($29/mo) — `invoice_chaser_clients`, `supabase/functions/invoice-chaser-runner/`
- **After-Job Drip** ($29/mo) — `afterjob_drip_clients`, `supabase/functions/afterjob-drip-runner/`
- **Seasonal Promo Blaster** ($29/mo) — `promo_blaster_clients`
- **Referral Program** ($39/mo) — `referral_program_clients`, `referrals`
- **Slow Day SMS** ($25/mo) — `slow_day_clients`, `supabase/functions/slow-day-trigger/`
- **New Homeowner Campaign** ($59/mo) — `homeowner_campaign_clients`
- **Migration**: `supabase/migrations/20260403000000_ten_new_products.sql`
- **Crons**: `supabase/migrations/20260403010000_new_product_crons.sql`

### Wave 2 Products (April 2026 — migrations 20260403xxxxxx)
- **Pet Memorial Service** — `pet_memorial_clients`
- **Dark Web Monitor** — `dark_web_monitor_clients`
- **Gov Contract Monitor** — `gov_contract_monitor_clients`
- **Podcast Revenue Machine** — `podcast_revenue_clients`
- **Regulatory Monitor** — `regulatory_monitor_clients`
- **Competitor Pricing** — `competitor_pricing_clients`
- **Real Estate Newsletter** — `real_estate_newsletter_clients`
- **Trademark Watch** — `trademark_watch_clients`
- **Employee Credential Audit** — `employee_credential_audit_clients`
- **New Hire Breach Screen** — `new_hire_breach_clients`

### Wave 3 Products (30 products — `20260404000000_thirty_new_products.sql`)
Each product has a dedicated `*_clients` table with RLS + service_role policy.

Products: Commercial Lease Abstractor, Patent Watch Intelligence, PE/Investor Sector Intelligence, Franchise Disclosure Analyzer, Regulatory Change Monitor, Nonprofit Grant Discovery, Government RFP Alert, AI Obituary Service, Competitor Price Intelligence, AI LinkedIn Ghostwriter, HOA Board Secretary AI, Local Gov Meeting Tracker, Agricultural Price Alert, Podcast Production Automation, Luxury Real Estate Intelligence, Trade Show Follow-Up, Corporate R&D Paper Intelligence, Insurance Agent Lead Drip, Credit Dispute Letter Factory, Airbnb/STR Reputation Manager, Restaurant Menu Engineering, AI Sermon Prep, Personal Trainer Progress Reports, Medical Bill Dispute Letters, HOA Violation Letter Generator, Multi-Location Citation Monitor, Supplement Stack Analyzer, Trade Association Intelligence, Children's Story Subscription, Landlord-Tenant Correspondence AI.

**SMS Compliance Table**: `sms_opt_outs` (E.164 phone, `opted_out_at`, `source`) + `compliance_blocks` audit log — ALWAYS query before any Twilio send.

### Wave 4 Products (April 2026 — `20260405080000_seven_new_products.sql`)
- **Storm Damage Lead Blaster** ($29/mo) — `storm_lead_clients`, `storm_alerts_sent`, `supabase/functions/storm-lead-blaster/`, route: `/storm-leads`
- **Recall Alert Service** ($19/mo) — `recall_alert_clients`, `supabase/functions/recall-alert-checker/`, route: `/recall-alerts`
- **Permit Watch** ($29/mo) — `permit_watch_clients`, `supabase/functions/permit-watch-scanner/`, route: `/permit-watch`
- **Website Speed Audit** ($29/mo) — `speed_audit_clients`, `supabase/functions/website-speed-audit/`, route: `/website-speed-audit`
- **AI Bedtime Stories** ($4.99/mo) — `bedtime_story_clients`, `supabase/functions/bedtime-story-sender/`, route: `/bedtime-stories`
- **Neighborhood Crime Digest** ($19/mo) — `crime_digest_clients`, `supabase/functions/crime-digest-sender/`, route: `/crime-digest`
- **Business License Monitor** ($25/mo) — `license_monitor_clients`, `license_monitor_items`, `supabase/functions/license-expiry-checker/`, route: `/license-monitor`
- **Local Tech Support** ($49 session / $29/mo) — `tech_support_tickets`, route: `/tech-support`

### Wave 5 High-Ticket Products (April 2026 — `20260405140000` + `20260405140001`)
- **Regulatory Filing Monitor** ($497/mo) — `reg_filing_clients`, `reg_filing_items`, `reg_filing_drafts`, `reg_filing_deadlines`, `supabase/functions/reg-filing-scan/`, `reg-filing-approve/`, `create-reg-filing-checkout/`, route: `/regulatory-filing-monitor`
- **Bid Intelligence & Proposal Factory** ($599/mo) — `bid_intel_clients`, `bid_intel_opportunities`, `bid_intel_proposals`, `supabase/functions/bid-intel-scan/`, `bid-intel-approve/`, `create-bid-intel-checkout/`, route: `/bid-intelligence`
- **Morning Digest** — `supabase/functions/morning-digest/` (daily 6:30am ET consolidated approval email to Matt)
- **Crons**: `20260405140002_new_product_crons.sql` — reg-filing-scan 6am ET, deadline check 8am ET, bid-intel-scan 7am ET, morning-digest 6:30am ET

### Detroit Web Agency Products (April 2026 — `20260410300000_hire_alert_tables.sql`)

**Brand**: Detroit Web Agency — "We Handle The Tech." Dark teal (`#00d4ff`) on near-black (`#0a1628`). Domain: detroitwebagent.com

**Named Product Suite (3 products + add-ons):**

- **FieldDesk** ($199/mo standalone → $159/mo with website) — Field service CRM replacing eWay CRM ($27-40/user/mo). Dispatch board, GPS tech map, mobile tech app (PIN login, job status, photo upload), auto-SMS on status changes. Target: HVAC/plumbing/boiler/electrical companies 3-15 techs.
  - Tables: `field_crm_clients`, `field_service_jobs`, `tech_locations`, etc.
  - Route: `/field-service`, `/field-service/dispatch`, `/field-service/tech`
  - Stripe webhook: `field_service_subscription`
  - Key pitch: "eWay is an Outlook plugin. FieldDesk works in a boiler room."

- **SiteRadar** ($49/mo standalone → $39/mo with website) — Visitor intelligence. Identifies businesses visiting client website by IP reverse lookup. Company name + page visited appears in real-time feed.
  - Tables: `field_crm_clients` (visitor_script_key), `crm_visitor_events`
  - Admin: `VisitorIntelFeed.tsx`, `AdminFieldCRMClients.tsx` (snippet generator)

- **TechAlert** ($99/mo standalone → $49/mo bundle) — Hiring monitor. Daily cron scans Michigan MIOSHA public license DB + Apollo people search + job boards for available licensed tradespeople. Scores candidates 1-10 via Claude Haiku. Score 7+ = immediate SMS+email alert to matching clients. Score 5-6 = daily digest. Below 5 = stored only.
  - Tables: `hire_alert_clients` (target_roles text[]), `hire_alert_candidates`, `hire_alert_runs`
  - Functions: `supabase/functions/hire-alert-scanner/index.ts` (cron 7am ET), `supabase/functions/create-hire-alert-checkout/index.ts`
  - Route: `/hire-alert`
  - Stripe webhook: `hire_alert_subscription` (wired — self-serve checkout LIVE at `/hire-alert`)
  - Migration: `supabase/migrations/20260410300000_hire_alert_tables.sql`
  - Founder daily report: emails matt@mattmichelstraining.com each morning with dark navy/teal premium HTML email — KPI dashboard (scanned/new/hot/alerted), source breakdown, full candidate table
  - Client alert emails: score-colored candidate cards, clickable contact links, urgency bar when hot candidates found
  - Welcome email: premium HTML with three source cards (MIOSHA/Apollo/Job Boards) and tiered alert explainer
  - Secret weapon: Michigan MIOSHA publishes every licensed boiler operator. New license issued = new talent entering market. No other recruiting tool monitors this.

**DWA Add-Ons (20% off for website clients):**
- Seasonal Promo Blaster: $29/mo → $23/mo bundled *(replaced GBP AI Posts in add-on list — GBP AI Posts still runs, folded into $99/mo management retainer silently)*
- Review Monitor: $25/mo → $20/mo
- After-Job Drip: $29/mo → $23/mo
- No-Show Re-Booker: $25/mo → $20/mo
- Estimate Follow-Up: $39/mo → $31/mo
- Weekly SMS Blast: $19/mo → $15/mo

**DWA Admin Tab** (`/admin` → "Detroit Web Agency" tab):
- `AdminDWAOverview.tsx` — stats, $0 test checkout buttons, scanner invoke, quick links
- `AdminHireAlertClients.tsx` — TechAlert client management + scanner run history + candidate table
- `AdminFieldCRMClients.tsx` — FieldDesk clients + snippet generator
- Plus: SiteRadar feed, Dispatch Map, Review Engine, Web Design CRM, Prospector, Demo Links, Scouting

**Key marketing brief**: `knowledge/field-service-brief.md` — cold email angles, bundle math, eWay replacement talking points, MIOSHA hook, Pat demo sequence

## Codebase Scale
- **293** frontend pages in `src/pages/`
- **539** Supabase Edge Functions in `supabase/functions/`
- **414** migration files (all dated 2026)
- **31** AI agents in `.claude/agents/`
- **67+** product lines across 5 waves + DWA suite
- **298** routes in `src/App.tsx`

This is a large codebase. Navigate by product name patterns in this document — don't scan all files. New product checklist: 1 migration, 1–2 edge functions, 1 page, 1 admin CRM entry (AdminOpsCenter + AdminClientHealth).

## Frontend Architecture

### Page Loading
All pages use `lazyRetry()` — a custom wrapper around `React.lazy()` that retries failed chunk loads 3 times. Never use plain `React.lazy()` directly.
- **Location**: `src/lib/lazyRetry.ts`
- **Import**: `import { lazyRetry } from "@/lib/lazyRetry"`

### Provider Stack (outermost → innermost, `src/App.tsx`)
`PersistQueryClientProvider` → `SplashScreen` → `AuthProvider` → `TimerProvider` → `OfflineSyncProvider` → `TooltipProvider`

### Route Guards
- `ProtectedRoute` — requires authentication
- `SubscriptionGuard` — requires active subscription
- `BlurGate` — blurs content without subscription

### Component Directories (`src/components/`)
`admin/`, `auth/`, `billing/`, `checkout/`, `dashboard/`, `exercise/`, `features/`, `gamification/`, `generator/`, `landing/`, `layout/`, `marketing/`, `nutrition/`, `pricing/`, `profile/`, `programs/`, `progress/`, `sessions/`, `shared/`, `store/`, `teams/`, `ui/`, `workout/`, `zone/`

### Utilities (`src/lib/`)
`addons.ts`, `admin-guides.ts`, `browserStorage.ts`, `fbpixel.ts`, `fulfillment-guides.ts`, `gtag.ts`, `jwtErrors.ts`, `lazyRetry.ts`, `queryClient.ts`, `siteTemplates.ts`, `utils.ts`

### Hooks (`src/hooks/`)
`use-mobile.tsx`, `use-toast.ts`, `useAiStream.tsx`, `useAuth.tsx`, `useBrowserNotifications.tsx`, `useExerciseCount.tsx`, `useFamilyUserIds.tsx`, `useGeoState.tsx`, `useInView.tsx`, `useIsAdmin.tsx`, `useOfflineSync.tsx`, `usePoints.tsx`, `useReferral.tsx`, `useSiteContent.tsx`, `useTierAccess.tsx`, `useTimer.tsx`, `useTrialStatus.tsx`, `useWorkoutSave.tsx`

### Data Fetching
TanStack Query v5 with localStorage persistence via `PersistQueryClientProvider`.

### Build
- Dev server: port `8080`
- Build target: `es2020` + `safari14`
- Code splitting: vendor chunks for react, supabase, query, ui, motion, charts
- PWA: `vite-plugin-pwa` + workbox
- Required env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

## Edge Function Conventions
- 539 functions in `supabase/functions/[name]/index.ts` — navigate by product name
- Shared utilities: `supabase/functions/_shared/ai.ts` (generateText, generateJSON), `_shared/twilio.ts` (sendSMS with TCPA), `_shared/email-templates/`, `_shared/transactional-email-templates/`
- Autonomous scheduled functions: `tom-autonomous`, `oz-autonomous`, `scarlett-autonomous`, `selma-autonomous`, `ops-autonomous`
- AI calls: Claude Haiku only (`claude-haiku-4-5`), `max_tokens` 800–1200
- Stripe: always inline `price_data`, always set `metadata.type` for webhook routing
- SMS: query `sms_opt_outs` (by E.164 phone) before every Twilio send — TCPA compliance
- New functions inherit secrets automatically via GitHub Actions on next merge to main

## Deployment
- **Primary**: Lovable Cloud — runs edge functions, hosts frontend, all secrets configured there
- **Secondary**: Supabase project `zmyczlfuufhngzovkjdh` — deployed via GitHub Actions on merge to main. Only relevant if using this project directly.
- Claude commits to dev branch → Matt merges to main → Lovable auto-deploys frontend + edge functions
- GitHub Actions (`.github/workflows/deploy-supabase.yml`) deploys to the secondary project:
  - Deploys `missed-call-handler` (with `continue-on-error: true` — function doesn't exist on secondary, silently skipped)
  - Deploys `contractor-lead-notify` — the 15-min cron that SMS-notifies contractors of new leads
  - Syncs all secrets (Twilio, Resend, Stripe, etc.) to the secondary project
- **Secondary project function limit**: The secondary project is at its Supabase free-tier function limit (~25). Adding new functions via MCP `deploy_edge_function` will fail with "Max number of functions reached." Only update existing functions via GitHub Actions. To add a new function to secondary, remove an unused one first or upgrade the plan.

## Secrets (all configured in Lovable Cloud)
All secrets below are already set in Lovable Cloud and working. Do NOT add secrets to the secondary Supabase project unless specifically needed there.

### Core
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` — payments
- `RESEND_API_KEY` — all email sends
- `ANTHROPIC_API_KEY` — AI features (Claude Haiku)
- `LOVABLE_API_KEY` — used by many edge functions

### Google
- `GOOGLE_MAPS_API_KEY` — prospecting, GBP
- `GOOGLE_PAGESPEED_API_KEY` — Website Speed Audit
- `GOOGLE_SERVICE_ACCOUNT_KEY`, `GOOGLE_PRIVATE_KEY_B64`, `GOOGLE_CALENDAR_ID` — calendar

### SMS (Twilio)
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`, `TWILIO_API_KEY`
- **Approved phone number**: `+13139921219` — A2P 10DLC registered (Low Volume Mixed messaging service), approved April 2026
- **Twilio webhook URL** (voice/missed call): `https://zmyczlfuufhngzovkjdh.supabase.co/functions/v1/missed-call-handler`
- **Secondary project secrets**: Secrets are synced automatically to `zmyczlfuufhngzovkjdh` via the GitHub Actions workflow on every merge to main — no manual secret management needed. The secondary project handles webhook endpoints (`missed-call-handler`) and the contractor lead cron (`contractor-lead-notify`). All other functions run on the Lovable primary project.

### Social Media
- `META_ACCESS_TOKEN`, `META_APP_ID`, `META_APP_SECRET`, `META_PAGE_ID` — Facebook/Instagram
- `LINKEDIN_ACCESS_TOKEN`, `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET` — LinkedIn

### Data & Monitoring
- `FIRECRAWL_API_KEY` — web scraping (Grant Finder, Market Intel, etc.)
- `DATAFORSEO_LOGIN`, `DATAFORSEO_PASSWORD` — SEO agents
- `HIBP_API_KEY` — Dark Web Monitor, Breach Screen
- `SAM_GOV_API_KEY` — Government Contract Monitor
- `NOAA_API_KEY` — Storm Damage Lead Blaster

### Automation
- `N8N_MCP_URL`, `N8N_ACCESS_TOKEN` — n8n integrations

## Agents (31 total — in `.claude/agents/`)

### Core (original)
- **Tom** (`Tom.agent.md`) — lead hunter, web design client acquisition
- **Oracle** (`Oracle.agent.md`) — account watchdog, queries all product tables for health issues
- **Ops** (`ops-autonomous.md`) — project fulfillment, web design client onboarding
- **Builder** (via `builder` skill) — website generation

### Autonomous Loop Agents (paired edge functions)
- **tom-autonomous** — continuous lead gen pipeline
- **oz-autonomous** — growth + ops overseer
- **scarlett-autonomous** — creative marketing & ad strategy
- **selma-autonomous** — head of marketing & ad strategy

### Specialized Agents
- **Aff** — affiliate revenue tracker
- **Cashier** — revenue & payment monitor
- **Comply** — TCPA/CAN-SPAM/Stripe/Meta/Twilio compliance
- **Critic** — negative feedback aggregator
- **Drill** — content pipeline monitor
- **Guard** — security & access guard
- **Hype** — social proof & testimonial harvester
- **Invest** — revenue reinvestment strategist
- **Launch** — go-to-market orchestrator
- **Luna** — victory monitor & growth celebrator
- **Mirror** — retention creative strategist
- **Mute** — SMS/email opt-out & TCPA compliance monitor
- **Nova** — new client onboarding orchestrator
- **Pulse** — SMS product health monitor
- **Red** — security auditor & stress tester
- **Ref** — referral program monitor
- **Rev** — revenue operations
- **Scout** — competitive intelligence monitor
- **Shield** — churn prevention monitor
- **Solo** — direct acquisition optimizer
- **Trim** — content quality & freshness auditor
- **Upsell** — cross-sell & upgrade identifier
- **Vera** — lead qualification filter
- **Zero** — ad spend auditor & campaign kill switch

> **"Create an agent"** = create a `.md` file at `.claude/agents/[name].md`

## Testing
- **Admin Sandbox** (`/admin` → Sandbox tab) — $0 test checkout for every product
- `supabase/functions/create-test-checkout/` — test session creator (Matt's email only)
- `AdminOpsCenter` — CRM roster covering all 64+ product lines with MRR totals

## Rules
- Matt's only manual work: return messages
- Never build features requiring ongoing manual operation
- All new tables get RLS enabled + service_role policy
- Stripe: always inline price_data, always set metadata.type for webhook routing
- AI calls: Claude Haiku only (`claude-haiku-4-5`), max_tokens 800-1200
- Always use project ref `zmyczlfuufhngzovkjdh`
- **"Create an agent"** always means: create a `.md` file at `/home/user/m2training/.claude/agents/[name].md`
- SMS sends: always query `sms_opt_outs` table (E.164 phone format) before sending — TCPA requires immediate opt-out honoring; failures logged to `compliance_blocks`

## Code Quality Rules (enforced every session)
- **stripe-webhook**: Always use `sendM2Email()` and `notifyMatt()` helpers — never raw `fetch()` to Resend
- **stripe-webhook**: Always use `${SUPABASE_URL}/functions/v1/...` for function URLs — never hardcode the project ref in URLs
- **Edge functions**: Read env vars at top-level (module scope), not inside request handlers
- **Edge functions**: Parallelize independent async ops with `Promise.all()` — especially email sends
- **Edge functions**: AI model in `_shared/ai.ts` is `claude-haiku-4-5` (equivalent to `claude-haiku-4-5-20251001`)
- **Twilio**: ALWAYS use `import { sendSMS } from "../_shared/twilio.ts"` for SMS sends — NEVER define a local sendSMS function. The shared version checks `sms_opt_outs` before every send (TCPA compliance). Signature: `sendSMS(to, from, body, product?)`
- **No dead code**: Delete unused imports, variables, and functions — don't comment them out
- **Auto-onboard**: When adding new products, add a welcome email template to `supabase/functions/auto-onboard/index.ts` TEMPLATES dict
- **Admin dashboards**: When adding new products, add entries to BOTH `AdminOpsCenter.tsx` ALL_SERVICES array AND `AdminClientHealth.tsx` SERVICE_TABLES array
- **JWT verification**: Most edge functions have `verify_jwt = false` in `supabase/config.toml` — this is intentional for public checkout/webhook endpoints. Internal auth is handled within functions. Exception: `process-email-queue` uses `verify_jwt = true`.
- **RLS security**: Anonymous insert policies on sensitive tables must be removed — use service_role via edge functions instead. Recent migrations (20260406+) tightened RLS on `contractor_leads`, `training_programs`, and `newsletter_subscribers`.
- **Supabase URL**: The vite.config.ts fallback URL (`eauvubfpanpeuxsrqesu.supabase.co`) is the Lovable-hosted project. The secondary GitHub Actions project ref is `zmyczlfuufhngzovkjdh`. In edge functions always use `Deno.env.get("SUPABASE_URL")` — never hardcode either URL.
