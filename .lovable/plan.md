## Goal
Turn on aggressive cold-email sending across every DWA product, fix the silence on TechAlert/Talent Radar, confirm trials are wired, weight volume toward products with the deepest lead inventory, and attach an Angie's-List–style teaser card to every send.

## What I found (current state)

**Sending today:**
- `techalert-outreach` — 8am ET, capped 30/day. `techalert-followup-drip` 9am+2pm, 50/day.
- `channel-prospector-followup` — 10am ET, 40/day (fax/postcard/SMS, not email).
- `dead-lead-drip` — D1 SMS only.
- `mortgage-radar-outreach` — runs but volume small.
- `marketplace-outreach-blast` — manual only.
- Trade Radar (11 verticals), FieldDesk, SiteRadar, Missed-Call, Buyer Radar, Demand Radar, Contractor Leads, Bundle Suite — **no cold-email cron at all**.

**Why TechAlert/Talent Radar feels silent:**
- 30/day cap + drip cap 50/day, but `techalert-enrich` only drains 25 prospects/run → top of funnel starves the outreach function.
- No teaser/lead-card asset in the email body — just plain pitch copy.
- Cron deploy needs verifying after Phase 43 token issue.

**Trials:** Phase 44 shipped `trial-drip-runner` + SLA columns on `trial_signups` (D0/D1/D3/D7/D14, auto-compensation). Coupon `INTRO50_3MO` exists. Trial-eligible products per `pricing-matrix.md`: Mortgage Radar, Trade Radar, FieldDesk, SiteRadar, Missed-Call, AI Phone, Bundle Suite. TechAlert / Contractor Leads / Dead Lead = no trial by directive.

**Angie's-List parity:** `TradeRadarLeadCard.tsx` (Street View, score meter, signal badge, opener, job value) already beats Angie's basic listing on signal freshness + intent score. We do NOT yet beat them on: review aggregation, before/after photos, multi-quote UI. For email teasers we have the components — just not embedded in outbound.

## Plan

### 1. Unstarve TechAlert/Talent Radar (highest priority)
- Raise `techalert-enrich` drain: 25 → 100/run, add a second cron at 1pm ET.
- Raise `techalert-outreach` daily cap: 30 → 150, add second send window at 1pm ET.
- Raise `techalert-followup-drip` cap 50 → 150.
- Verify deploy of all 3 functions on primary project; trigger manual run; confirm `email_send_log` rows.

### 2. Turn on cold email for every product that has lead inventory
Create one new edge function per product (or extend existing scanner) that drains the product's lead/prospect table → sends branded cold email → logs to `email_send_log`. Daily caps weighted by inventory:

| Product | Source table | Daily cap | Why |
|---|---|---|---|
| Trade Radar (11 verticals) | `trade_radar_leads` (claimed=false) | 200/day pooled | Largest inventory |
| Mortgage Radar | `mortgage_radar_leads` | 100/day | Strong intent signals |
| Contractor Leads | `marketplace_prospects` | 100/day | PPL marketplace |
| TechAlert | `hire_alert_candidates` | 150/day | Per #1 |
| FieldDesk | `field_service_jobs` (uncovered metros) | 50/day | Smaller TAM |
| SiteRadar | identified visitors w/o owner | 50/day | Warm signal |
| Missed-Call | `missed_call_clients` prospects | 40/day | Cold list |
| Buyer Radar / Demand Radar | radar signals | 40/day each | Newer products |
| Dead Lead Reactivation | (already SMS-only — add email D2) | 60/day | Channel diversification |

All sends gated by:
- `marketing-kill-switch.ts` global flag
- `outreach-blocklist.ts` suppression
- `cold-email-ramp-scheduler` deliverability throttle (already exists from Phase 37)
- `_shared/twilio.ts` quiet-hours rules don't apply to email but TCPA/CAN-SPAM unsubscribe footer required

### 3. Angie's-List–style teaser card in every email
- New shared template `_shared/email-templates/lead-teaser-card.tsx` — React Email component rendering: hero image (Street View or product mock), score badge, signal type, "Open in your dashboard →" CTA, blurred-out PII for non-customers (per `TradeRadarTeaserAd.tsx` pattern).
- Every product's outreach function imports and embeds this card. Card data pulled from product's lead row.
- For trial-eligible products: card CTA = `/start-trial?product=<key>` (uses existing `offers.ts` + `INTRO50_3MO` coupon).
- For non-trial products (TechAlert, Contractor Leads, Dead Lead): CTA = direct checkout.

### 4. Confirm trials end-to-end
- Verify `trial-drip-runner` cron is firing (query `cron.job`).
- Spot-check `trial_signups` SLA columns populated.
- Confirm 7 trial-eligible checkout functions still pass `trial_period_days=7` + `INTRO50_3MO`.
- Add a test trial signup, watch SLA flip from `pending` → `met`.

### 5. New unified pg_cron schedule (ET)
| Time | Function |
|---|---|
| 8am | trade-radar-cold-email-blast (200) |
| 8am | techalert-outreach (150) |
| 9am | mortgage-radar-cold-email-blast (100) |
| 9am | contractor-leads-cold-email-blast (100) |
| 10am | fielddesk + siteradar + missedcall blasts |
| 11am | buyer-radar + demand-radar blasts |
| 1pm | techalert-outreach round 2 |
| 2pm | techalert-followup-drip |
| 3pm | dead-lead-email-touch (D2) |

All caps governed by `cold_email_ramp_state` so we don't burn the domain.

### 6. Are we beating Angie's List?
**Yes on signal & intent, no on UX depth.** We win on: (a) live permit/storm/foreclosure signals Angie doesn't have, (b) score+suggested opener per lead, (c) Street View context, (d) one-channel-per-lead claim model vs their multi-quote spam. We lose on: (a) review aggregation, (b) before/after gallery, (c) consumer-facing brand recall. Email teaser card closes the visual gap; full UX parity is a separate roadmap item.

## Technical specifics
- New functions: `<product>-cold-email-blast/index.ts` × 8, plus shared `_shared/email-templates/lead-teaser-card.tsx`.
- New migration: `cold_email_send_state` extension columns for per-product cap overrides + `last_blast_at` on each product's prospect/lead table.
- Cron migration: `<date>_unified_cold_email_crons.sql` — uses hardcoded URL + `SUPABASE_SERVICE_ROLE_KEY_VAULT` per Phase 43 fix.
- All functions: `verify_jwt = false` in config.toml.
- All sends write `email_send_log` with `template_name='<product>-cold-blast'` for the dashboard.
- DWA-branded via `dwaEmail()`.

## Verification after build
- Curl each blast function manually, confirm 200 + non-zero `sent_count`.
- Query `email_send_log` last 1h grouped by template_name.
- Send Matt a single SMS summary with per-product send counts after the first full daily cycle.
