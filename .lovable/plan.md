# Trial Delivery Guarantee — Audit Response & Silent-Killer Sweep

## Why Claude's audit found gaps

Honest answer: my prior plan duplicated schema (`trial_delivery_sla`, `trial_concierge_log`) instead of grepping for the existing `trial_signups` and `trial_drip_state` tables. I built parallel infrastructure rather than extending what was already live. That's the failure mode — I wrote a plan from intent, not from the codebase. Claude is right.

**Guardrails going forward** (applied to this plan and all future ones):
1. Before proposing any new table, `rg` for the noun in `supabase/migrations/` — extend, don't duplicate.
2. Before proposing any new edge function, `rg` for the trigger event in existing functions — patch, don't fork.
3. Every plan ends with a "What already exists that I'm NOT touching" section to force the audit.
4. Silent-killer sweep: any function that can return early on empty data must have a proof-of-work fallback.

---

## Plan: Adopt all 11 enhancements

### Schema (one migration, not two tables)
- `20260506000000_trial_signups_delivery_columns.sql` — add to `trial_signups`: `first_lead_delivered_at`, `lead_count_d1..d7`, `sla_status` (green/yellow/red), `compensation_applied_at`, `compensation_amount_cents`, `last_concierge_touch_at`.
- `20260506000001_trial_lead_count_triggers.sql` — Postgres triggers on `trade_radar_leads` and `mortgage_radar_leads` that increment the correct `lead_count_d{N}` column based on `NOW() - trial_started_at`. Zero scanner edits needed.
- `20260506000002_trial_drip_runner_cron.sql` — daily 15:00 UTC pg_cron for `trial-drip-runner` (uses correct vault pattern from CLAUDE.md).

### One drip runner replaces four functions
- `supabase/functions/trial-drip-runner/index.ts` — wrapped in `withTelemetry`. Calculates `days_elapsed`, fires day2/day5/day6/day4-comp touches. Idempotent via `trial_drip_state` lookup on `(trial_signup_id, touch_key)`.
- Day-4 auto-compensation: if `sla_status='red'` and `lead_count_d{1..3} < min_for_product`, call Stripe `subscriptions.update` with `trial_end` extended +7 days, write `compensation_applied_at`, SMS Matt + customer.
- Per-product minimums hardcoded: trade=3/3d, mortgage=2/3d, contractor=2/3d, talent=1/3d.

### Scanner patches (proof of delivery)
- `trade-radar-scanner/index.ts` — after lead insert batch, if any `client_id` has a matching `trial_signups` row with `first_lead_delivered_at IS NULL`, set it.
- `mortgage-radar-scanner/index.ts` — same write + add score≥9 SMS (parity with trade scanner, using shared `sendSMS`).

### Welcome SMS personalization (E10)
- `stripe-webhook/index.ts` — both Trade and Mortgage welcome SMS blocks: extract `firstName` from `meta.contact_name`, rewrite copy to Matt's voice ("Hey {first} — it's Matt. Your trial just started…"). Fallback to "there" if no name.

### DEPLOY SMS keyword (E6)
- `inbound-sms-relay/index.ts` — add `DEPLOY <function-name>` handler. Validates function name against allowlist (functions present in `supabase/functions/`), POSTs to GitHub `workflow_dispatch` for `deploy-supabase.yml` with the function name as input, replies with run URL. Requires `GITHUB_PAT` secret with `repo` + `workflow` scope.
- Workflow update: `.github/workflows/deploy-supabase.yml` accepts a `function_name` input; when present, runs `supabase functions deploy <name>` only.

### Shared UI component (E7)
- `src/components/shared/LeadGuaranteeBar.tsx` — extract from `TradeRadarPortal`. Props: `productName`, `creditEmail`.
- Wire into: `MyMortgageRadar.tsx`, `MySiteRadar.tsx`, `MyContractorLeads.tsx`, `TalentRadar/dashboard`.

### Trial Health admin tab (E8) — replace current AdminTrialHealth
- Rewrite `src/components/dwa-admin/AdminTrialHealth.tsx` to query `trial_signups` (not `trial_delivery_sla`). Show: name/email, product, days elapsed, lead counts d1–d7, SLA badge, last touch, actions (Extend Trial via Stripe, Send SMS, View Leads, View concierge log from `trial_drip_state`).
- Existing `HealthComplianceHub.tsx` "🎯 Trial Health" tab already wired — just points at the rewritten component.

### Proof-of-work digest sweep (E11 — silent-killer kills)
Apply zero-lead fallback to:
- `demand-radar-digest/index.ts`
- `site-radar-weekly-digest/index.ts`
- `techalert-weekly-digest/index.ts`
- `contractor-welcome-sequence/index.ts` (Day-2 path)

Each must always send something on its scheduled run, with telemetry recording outcome reason.

### Cleanup
- Delete redundant `trial_delivery_sla` and `trial_concierge_log` tables created in the prior bad plan (drop migration). Migrate any rows (likely empty) before drop.
- Delete `supabase/functions/trial-sla-watchdog/` (replaced by `trial-drip-runner`).
- Remove its cron entry.

---

## Other silent killers I went hunting for

While auditing, I checked for the same class of bug elsewhere. Findings to confirm during build:
1. **Welcome emails on non-trade products** — verify FieldDesk, SiteRadar, Missed-Call, TechAlert, Contractor Leads webhooks all send a welcome email AND fire their scanner (Trade + Mortgage do, others may not). Patch any that don't.
2. **`enriched_at` set on failure** — confirmed in `outreach-leads-enrich`; check `techalert-enrich` does the same to prevent infinite retries.
3. **Scanner runs that find 0 rows** — every scanner should write a `system_telemetry` row with `outcome='no_signals'` so dashboards show "ran, found nothing" vs "didn't run". Audit all 11 trade scanners + mortgage + techalert.
4. **Cron jobs with broken vault patterns** — re-run the audit from Phase 43; grep all migrations for `current_setting('app.supabase_url')` and `WHERE name = 'SUPABASE_SERVICE_ROLE_KEY'` (without `_VAULT` suffix). Fix any survivors.
5. **`fulfillment_status='pending'` rows older than 1 hour** — `stripe-webhook` self-healing retry should sweep these; verify the retry cron exists and is firing (per Stripe webhook memory).

---

## Verification checklist (run after build)
- [ ] `SELECT first_lead_delivered_at, sla_status, lead_count_d1 FROM trial_signups LIMIT 5` returns columns
- [ ] Insert test lead for trial client → trigger fires → `lead_count_d1` increments
- [ ] Manual invoke `trial-drip-runner` on Day-2 fixture → `trial_drip_state` row written with `touch_key='day2'`
- [ ] Day-4 fixture with 0 leads → Stripe subscription `trial_end` extended; `compensation_applied_at` set
- [ ] Test trade checkout → SMS reads "Hey {name} — it's Matt"
- [ ] Text "DEPLOY pipeline-health-monitor" → GitHub Actions run appears
- [ ] Mortgage lead score=9 → SMS arrives
- [ ] HealthComplianceHub → Trial Health tab renders live `trial_signups` rows
- [ ] All 4 digest functions send something on a forced zero-lead run

---

## What already exists that this plan does NOT touch (the audit I should have done first)
- `trial_signups`, `trial_drip_state` tables — extending only
- Welcome SMS/email infrastructure in `stripe-webhook` — copy change only
- Fire-and-forget scanner triggers on signup — already live
- Score-9 SMS in trade scanner — already live (only adding parity to mortgage)
- OnboardingChecklist in 7 portals — keeping as-is
- HealthComplianceHub shell — keeping; only rewriting the Trial Health child
- `system_telemetry` + `withTelemetry` wrapper — using as-is

Approve and I'll execute end-to-end, then run the verification checklist and report results.