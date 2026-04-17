User has 3 immediate issues + a major QA pass:

1. **PWA install prompt firing on detroitwebagent.com** — "Install M² Training" banner appearing on DWA domain. Need to disable PWA sitewide OR scope it to only m2 domain.
2. **ROI report token not clickable** — SMS shows the URL as text not as a tappable link. Looking at the SMS body: `Full report: https://detroitwebagent.com/roi?token=22899e...` — the issue is likely the **trailing dash** `— Matt (313)...` being interpreted as part of the URL by Google Messages, OR the URL is fine but Android isn't auto-linking due to the long token. Actually looking again — the screenshot shows "Tap to load preview" which means the URL IS detected. The user might mean the dashboard cards themselves aren't clickable.
3. **10 duplicate weekly ROI texts** — `contractor-roi-sms` cron fired 10x in one minute, OR loop sent to same number 10x. Need to investigate and add idempotency.

Then full QA across top 4 products (Contractor Leads, Missed Call Catch, TechAlert, FieldDesk).

# Plan: Fixes + Full QA Sweep

## Part 1 — Three Bug Fixes (15 min)

### Fix 1: Kill PWA install prompt on DWA domain

- **Root**: `vite.config.ts` registers `vite-plugin-pwa` with M² Training manifest globally. Browser shows install banner on every domain.
- **Fix options**: 
  - (A) Scope manifest registration to hostname check in `index.html` — remove `<link rel="manifest">` for non-m2 domains via inline script
  - (B) Disable PWA install prompt entirely with `beforeinstallprompt` event handler that calls `e.preventDefault()` on DWA hostnames
- **Recommendation**: Both. Inline script in `index.html` strips manifest link if `hostname.includes('detroitweb')`. Belt + suspenders.

### Fix 2: ROI report — make stat cards clickable + URL hardening

- Looking at `ContractorROIReport.tsx` — the 4 stat cards (Leads/Dead Leads/Missed Calls/Licenses) are static divs. User wants each to deep-link to relevant detail.
- Add `onClick` handlers:
  - Leads Delivered → `/contractor-leads`
  - Dead Leads Revived → `mailto:matt@detroitwebagent.com?subject=Dead Lead Detail`
  - Missed Calls Caught → `/missed-call-catch`
  - Licenses Monitored → `/license-monitor`
- Also harden SMS URL in `contractor-roi-sms`: add space before `—` so Android linkifier doesn't grab the em-dash. Already has space, but the long token may confuse the parser. Switch to shortlinks pattern: put URL on its own line.

### Fix 3: 10 duplicate ROI texts — investigate + idempotency lock

- Check `contractor-roi-sms` cron schedule + add a `last_roi_sms_sent_at` column to `contractor_clients` with 6-day cooldown guard so the function literally cannot send twice in a week.
- Investigate root cause via cron history + system_comms_log query.
- Add idempotency: `WHERE last_roi_sms_sent_at IS NULL OR last_roi_sms_sent_at < now() - interval '6 days'` then update timestamp atomically.

## Part 2 — Full QA Sweep on Top 4 Products (45 min)

For each: verify edge functions deploy, secrets present, crons firing, no silent failures, end-to-end checkout works.

### Contractor Leads ($399/mo)

- Verify `create-contractor-lead-checkout` deploys clean
- Verify `stripe-webhook` `contractor_lead_subscription` handler returns 500 on DB fail
- Verify `contractor-lead-notify` 15-min cron is scheduled + firing
- Verify `chargeContractor()` in `handle-dead-lead-reply` checks `res.ok` before parsing (KNOWN OPEN ITEM)
- Test welcome email renders DWA dark branding

### Missed Call Catch ($99/mo) I thought we changed the price? 

- Verify `create-missed-call-checkout` deploys
- Verify `missed-call-handler` Twilio webhook on +13139921219 returns valid TwiML
- Verify multi-tenant lookup by `To` number works (not hardcoded to Matt)
- Verify `send-missed-call-test` button works on /setup page
- Test welcome email DWA branding

### TechAlert ($99–149/mo) 

- Verify `create-hire-alert-checkout` deploys
- Verify `hire-alert-scanner-daily` cron at 7am ET is scheduled
- Verify Sonar/Apollo/MIOSHA scanners not hung (90s AbortController)
- Verify `hire_alert_runs` table populates after scan
- Verify alert dispatch SMS not duplicated (Batch 3 `talent-radar-sms-dispatch`)
- Check `MyTechAlert.tsx` loads without blank screen

### FieldDesk ($199/mo)

- Verify `create-field-service-checkout` deploys
- Verify demo route `/field-service/dispatch?demo=1` loads with 7 jobs
- Verify mobile tech app `/field-service/tech?demo=1` PIN login works
- Verify InvoiceGenerator renders + prints
- Verify DJ Conley demo `/demo-djconley-2` loads

## Part 3 — Cross-Cutting Checks (15 min)

- **Cron audit**: Query `cron.job` for all expected schedules, flag any missing or paused
- **Edge function deploy**: Deploy all touched functions, scrape logs for errors in last 24h
- **Secrets audit**: Verify TWILIO_*, STRIPE_*, RESEND_*, ANTHROPIC_*, LOVABLE_API_KEY, SUPABASE_SERVICE_ROLE_KEY
- **Stripe webhook**: Verify `vibrant-glow` endpoint healthy, no recent failed events
- **Silent killers from CLAUDE.md known list**:
  - `chargeContractor()` res.ok check (status: per CLAUDE Phase 16, this is FIXED — confirm)
  - stripe-webhook 200 on DB fail (status: partially fixed — verify all top-4 handlers)

## Files Touched (~6)

**Frontend (3)**:

- `index.html` — inline script to strip PWA manifest on DWA domain + suppress install prompt
- `vite.config.ts` — scope PWA registration if possible (or leave to runtime guard)
- `src/pages/ContractorROIReport.tsx` — clickable stat cards with deep links

**Edge functions (1)**:

- `supabase/functions/contractor-roi-sms/index.ts` — add 6-day cooldown lock + URL formatting

**Migration (1)**:

- `radar_roi_sms_dedup.sql` — `last_roi_sms_sent_at TIMESTAMPTZ` column on `contractor_clients`

**QA report (1)**:

- `/mnt/documents/DWA_Top4_Launch_QA_2026-04-17.pdf` — pass/fail per product, screenshots, list of any silent killers found + fixed

## Sequence

1. Migration + cooldown fix (5 min)
2. PWA disable on DWA + clickable ROI cards (10 min)
3. Deploy `contractor-roi-sms` + verify
4. QA Top 4: edge function deploys, cron status, secret check, log scrape (45 min)
5. Generate launch readiness PDF (10 min)
6. Final summary: GREEN/YELLOW/RED per product

## Investigation Questions (will answer during QA, no need to ask)

- Why did 10 ROI texts fire? Hypothesis: cron ran once but loop sent to same number, OR `roi_token` query returned 10 rows for same phone, OR cron schedule is misconfigured to run every minute. Will check `cron.job` table + `system_comms_log` timestamps.

Total scope: ~75 min. Result: 3 user-reported bugs fixed + launch-ready validation across top 4 revenue engines.