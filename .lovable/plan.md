# Full Customer-Path Live Audit — May 2026 Edition

Updated for current state: 258 email-sending edge functions, 11 Trade Radar verticals, new Phase 45 cron fixes, `fulfillment_status` tracking, fixer watchdog tables, and the just-shipped TechAlert plain-text conversion. The original prompt missed several new surfaces — this plan exercises them.

Output: single markdown report at `/mnt/documents/audit-2026-05-16.md` with PASS/FAIL tables, receipts (truncated SQL/curl), and a P0/P1/P2 fix list. Plan mode only — no code edits until you approve fixes.

---

## NEW Layer 0 — Email Template Format Audit (the issue we just fixed)

Goal: catch every place still rendering a dark-navy `dwaWrap` + teal trial CTA when the function is supposed to be plain-text cold outreach. This is the bug class from the TechAlert thread you just resolved.

- Enumerate all 258 outreach/blast/drip/digest/sender functions.
- Classify each by intent: **cold outreach** (must be plain-text via `dwaColdEmail({ plainMode: true })`), **transactional** (branded OK), **digest/newsletter** (branded OK), **trial nurture** (case-by-case).
- For every cold-outreach function: grep for `dwaWrap`, `trialCtaHtml`, `<table`, inline `style=`, and absence of `plainMode: true`. Any hit = candidate FAIL.
- For each candidate, fetch the last actual send from `email_send_log` (recipient redacted) and diff body shape: HTML payload length vs plain-text length, presence of CSS.
- Specific targets to spot-check: `techalert-trial-teaser-blast` (just converted), `siteradar-cold-blast`, `fielddesk-cold-blast`, `contractor-outreach-email-blast`, `dossier-cold-outreach-bulk`, `hoa-cold-outreach`, `counsel-cold-outreach`, `storm-lead-blaster`, `dwa-product-blast`, `web-design-drip`, `agency-prospect-list-blast`, `send-ameristeel-hub-email`, all `*-drip` functions, all `*-sender` functions whose name implies outbound.
- Deduplication & frequency check: SQL on `email_send_log` last 30d — any recipient hit by 2+ different cold templates within 7d? Any single template hit one recipient >3x?

---

## Layer 1 — Public links & SEO (lightly trimmed)

- Curl every URL in `public/sitemap.xml` + `public/robots.txt` (note: dynamic sitemap also lives at `generate-sitemap` edge function and `sitemap-hire` — both included).
- Grep every cold-email template in `_shared/` AND every `*-blast` / `*-drip` / `*-sender` for `https://` URLs; curl each. Flag cross-domain mismatches (m2training.lovable.app vs detroitwebagent.com vs mattmichelstraining.com vs pat.detroitwebagent.com).
- For every `create-*-checkout`: extract `success_url` + `cancel_url`, curl each, confirm `session_id={CHECKOUT_SESSION_ID}` placeholder present where `PostCheckoutClaim` is expected.
- Diff product keys: `src/data/productCatalog.ts` ↔ `StartTrial.tsx` PRODUCT_PITCH ↔ `create-*-checkout` set ↔ stripe-webhook handler arms. Four-way mismatch table.

## Layer 2 — Checkout → Webhook → Provisioning

- Enumerate all `create-*-checkout` functions (~22+ now, including new trial/multi-product/radar starters).
- For each: confirm top-level `metadata.type` set (NOT only inside `subscription_data.metadata`), matches a switch arm in `stripe-webhook/index.ts`, handler upserts the right `*_clients` table, sends welcome email through the correct brand wrapper (`dwaEmail` vs `m2Email`), and calls `markFulfilled(true)`.
- SQL: `stripe_webhook_events` last 30d — any `fulfillment_status IN ('failed','pending')` older than 5 min? Any `checkout.session.completed` with no matching client row?
- Curl `e2e-link-auditor` and `email-preflight-check` edge functions; paste output.

## Layer 3 — RLS & anon GRANTs (trial_funnel_events class)

For every table written by anon traffic — including newer ones — run the `information_schema.role_table_grants` query, then attempt a real anon INSERT via curl with the anon key. Expanded list:

`trial_funnel_events`, `email_unsubscribe_tokens`, `crm_visitor_events`, `missed_call_captures`, `marketplace_lead_locks`, `dead_lead_contacts`, `nps_responses`, `industrial_pulse_signups`, `trial_signups`, `radar_trials`, `contractor_leads`, `email_send_log` (insert-only paths), `error_logs` (fixer pipeline), `fixer_queue`.

Any grant wider than RLS policy intent = FAIL with the receipt.

## Layer 4 — Auth, magic-link, claim flows, portals

- `claim-session`, `PostCheckoutClaim`, `verify-dashboard-token` — curl each with synthetic session.
- All 23 `My*` portal routes in 4 states (logged out / logged in no sub / subscribed / admin). Verify `BlurGate` / `SubscriptionGuard` / `ProtectedRoute` behavior; no infinite redirect loops.
- Magic-link emails: confirm they route through the queue (`auth-email-hook` calls `enqueue_email`, not the old direct-send pattern).

## Layer 5 — Inbound webhooks

- Twilio voice → `missed-call-handler` → `voicemail-transcription-handler` → row in `missed_call_captures` + SMS to Matt & customer.
- `inbound-sms-relay`: FIX / ERRORS / FIXED? / STOP keywords each trip correct branch (FIX triggers `code-fixer-watchdog`, STOP writes to `sms_opt_outs`).
- Stripe webhook: unsigned event → 400; signed test → 200; `constructEventAsync` confirmed.
- Resend bounce/complaint → row in `suppressed_emails`.

## Layer 6 — Outbound compliance (email / SMS / fax / postcard)

For every outbound sender, confirm the four gates fire in order:
1. `outreach-blocklist` check
2. `email-suppression` / `sms_opt_outs` check
3. FCC quiet-hours gate (8am–9pm recipient local time)
4. Per-recipient frequency cap (the 6–8 emails/recipient bug)

Specifically verify on the new functions: `cold-email-bulk-queue`, `cold-email-pool-router`, `cold-email-quality-gate`, `cold-email-ramp-scheduler`, `cold-email-volume-sentinel`, `contractor-outreach-statewide-sweep`, `trade-radar-outreach`, `techalert-trial-teaser-blast` (post-conversion).

For every cold-email CTA: curl URL, verify 200 + `?utm_*` + `?product=` params.

SQL: `email_send_log` group-by recipient last 30d — flag any recipient with >4 distinct cold templates or >2 sends from one template in 7d.

## Layer 7 — Cron health (now ~60+ jobs)

- Run the 7-day success/fail query against `cron.job_run_details`.
- Scan ALL migrations (including the new Phase 45 fix migration) for banned vault patterns: `name='SUPABASE_URL'`, `name='SUPABASE_SERVICE_ROLE_KEY'`, `current_setting('app.supabase_url')`.
- For every job calling an edge function, confirm `verify_jwt = false` in `supabase/config.toml`.
- **NEW**: confirm `training-newsletter-weekly` (just added), `newsletter-send`, `sports-newsletter-weekly` are all on the canonical pattern and last ran successfully.
- Cross-check: every "scheduled" function the codebase implies (search for `schedule.*cron` mentions in function bodies) actually has a row in `cron.job`.

## Layer 8 — Silent failures & self-heal

- 7d `error_logs` group by source/severity.
- 7d `function_edge_logs` 5xx via `analytics_query`.
- `supabase--linter` — every error/warn listed.
- `dlq` table — any stuck items? Any > 24h old?
- **NEW**: `fixer_queue` + `fixer_runs` — is the auto-fixer actually firing on error_logs inserts? Last 7d throughput.

---

## Part B — 8-Product Customer Journey (updated)

For each product, the 5-check matrix (CHECKOUT / WEBHOOK / CLIENT ROW / PORTAL / FIRST VALUE) plus: welcome-email arm exists, `success_url` includes `session_id`, cron job actually exists in `cron.job`.

Products (unchanged set, but updated table/route names per current code):
1. TechAlert — `create-hire-alert-checkout` → `hire_alert_clients` → `/talent-radar/dashboard` → `hire-alert-scanner` cron → `hire_alert_candidates`
2. Trade Radar (roofing) — `create-trade-radar-checkout` → `trade_radar_clients` → `/my-roofing-radar` → `trade-radar-scanner` cron → `trade_radar_leads`
3. Mortgage Radar — `create-mortgage-radar-checkout` → `mortgage_radar_clients` → `/my-mortgage-radar` → `mortgage-radar-scanner` cron → `mortgage_radar_leads`
4. FieldDesk — `create-field-service-checkout` → `field_crm_clients` → `/my-field-desk` → `field_service_jobs`
5. Missed-Call — `create-missed-call-subscription` → `missed_call_clients` → `/my-missed-call` → `missed_call_captures`
6. SiteRadar — `create-site-radar-checkout` → `field_crm_clients` (visitor_script_key) → `/my-site-radar` → `crm_visitor_events`
7. Contractor Leads — `create-contractor-lead-checkout` → `contractor_clients` → `/my-contractor-leads` → `contractor_leads`
8. Dead Lead Reactivation — `create-dead-lead-checkout` → `dead_lead_campaigns` → `/dead-lead-intake` → `dead_lead_contacts`

---

## Part C — Final SQL Triad (verbatim output in report)

1. 7d cron job success/fail/last_run.
2. 7d error_logs grouped by source + severity.
3. Anon INSERT/UPDATE/DELETE grants in public schema.

---

## What's NEW vs. the old prompt

| New surface | Why it matters | How this plan covers it |
|---|---|---|
| TechAlert plain-text conversion | Just shipped — need to confirm no regressions | Layer 0 spot-check + body-shape diff |
| 258 outreach functions (was ~50) | Massive expansion since old prompt | Layer 0 classifier + Layer 6 compliance sweep |
| Phase 45 cron fixes (19 jobs) | Could still have stragglers | Layer 7 7d success query + banned-pattern scan |
| Fixer watchdog (`fixer_queue`/`fixer_runs`) | New self-heal path; could be silently broken | Layer 8 throughput check |
| Training newsletter personalization (in-flight) | New helper + cron | Layer 7 cron presence + Layer 0 brand classification |
| 11 Trade Radar verticals | Each has portal route + scanner | Part B Trade Radar uses roofing as canary; all 11 listed in Part B addendum |
| `email_send_log` deduplication rules | Required to count emails correctly | All SQL in Layers 0/6 uses `DISTINCT ON (message_id)` |
| Lovable Cloud queue (`process-email-queue`) | Auth emails should be queue-based now | Layer 4 confirms hook uses `enqueue_email` |

---

## Tools used (plan mode → audit only, no edits)

- `supabase--read_query`, `supabase--analytics_query`, `supabase--curl_edge_functions`, `supabase--edge_function_logs`, `supabase--linter`, `supabase--cloud_status`
- `code--exec` for `curl`, `rg`, classifier scripting against the 258 functions
- `code--view` only when receipts need line numbers

## NOT in scope

- No code edits (plan mode).
- No stripe live-mode purchases (test mode + webhook signature replay only).
- No bulk sends — we only sample from existing `email_send_log` rows.

## Deliverable

Single markdown report at `/mnt/documents/audit-2026-05-16.md`. Per-layer PASS/FAIL with receipts. Per-product 5-check matrix. P0/P1/P2 fix list with file + line + one-sentence fix. Closing prompt: "Which P0s do you want shipped in build mode?"

Approve to run, or tell me to narrow (e.g. "Layer 0 + Part B only, skip SEO").
