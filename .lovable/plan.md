## Wave 7 — Observability, Audit & Operator Tooling (8 items)

Building on Waves 5–6 (walker budget, DLQ aging, enrichment_confidence, quiet-hours, cost anomaly). Existing surfaces to reuse: `enrichment-e2e-verify`, `cron-sentinel`, `cron-status`, `cron_job_health`, `cron_schedule_audit`, `outreach_alerts_log`, `outreach_alert_cooldowns`, `enrichment_walker_runs`, `enrichment_dead_letter`, `enrichment_provider_spend_daily`.

---

### 1. Nightly E2E smoke suite (extend `enrichment-e2e-verify`)

Today the canary only hits the waterfall. Expand into a multi-check suite that runs before alerts can fire and writes pass/fail per check.

- New table `enrichment_e2e_checks` (run_id, check_name, status, detail, duration_ms).
- Edge function additions — for each run, execute and record:
  - **tables**: SELECT 1 row from `enrichment_walker_config`, `enrichment_walker_targets`, `enrichment_dead_letter`, `enrichment_provider_spend_daily`, `outreach_alerts_log`.
  - **rpcs**: dry-call `claim_lead_soft_lock` (rolled back), `reset_alert_cooldown('canary')`, `upsert_walker_target` with a fixture then `delete_walker_target`.
  - **ui endpoints**: HEAD/GET against deployed `cron-status`, `outreach-alert-evaluator?dry=1`, `enrichment-matrix-walker?dry=1`.
  - **waterfall canary**: existing check.
- Overall run is `pass` only if every check passes; `degraded` if any non-critical fails; `fail` blocks downstream alert evaluator from firing for that cycle (evaluator reads latest run before sending).
- Cron `enrichment-e2e-verify-nightly` already exists at 4 AM ET — reused.

### 2. Cron status widget (per-cron)

New `src/components/admin/CronStatusWidget.tsx` — compact card grid usable on multiple admin pages. Reads `cron-status` edge function output (already returns `cron_job_health` + history) plus `cron.job_run_details` aggregates.

Per cron card shows:
- Last run time + duration
- 24h success/failure counts (from `cron_run_status`)
- Next scheduled execution (computed from cron expression via `cronstrue` + simple next-fire calc)
- Status pill: green / amber (stale) / red (consecutive failures)

Mounted on Wave 5 dashboard (item 4) and on existing `/admin/cron-status` page.

### 3. Alert log search & filter (in `/admin/outreach-observability`)

Extend the existing **Walker & Alerts** tab in `OutreachObservability.tsx` (or add a new "Alert Log" sub-section in `EnrichmentWalkerAlertsPanel.tsx`):

- Filters: severity (info/warn/critical), reason (dropdown populated from distinct `outreach_alerts_log.reason`), date range (last 24h / 7d / 30d / custom), free-text search across `message`/`payload`.
- Server-side query against `outreach_alerts_log` with indexed filters; client-side debounce.
- Row expands to show full payload JSON + cooldown state from `outreach_alert_cooldowns` + link to "Reset cooldown" RPC.
- CSV export of filtered set.

### 4. Wave 5 admin dashboard

New page `src/pages/admin/Wave5Dashboard.tsx` (route `/admin/wave5`), composed of:
- **Walker spend (today + 7d)** — line chart from `enrichment_provider_spend_daily` (Apollo/Hunter/Snov/PDL) with the daily budget line overlaid from `enrichment_walker_config.daily_budget_usd`.
- **Daily budget status** — gauge + "walker paused / active" pill driven by spend vs cap.
- **DLQ aging buckets** — counts grouped by age (<1d, 1–3d, 3–7d, >7d) from `enrichment_dead_letter`.
- **Alert history (last 50)** — embeds the filterable log from item 3 in compact mode.
- **enrichment_confidence distribution** — histogram (10 buckets) from `prospects.enrichment_confidence` plus median/p25/p75 stats.
- **Embedded `CronStatusWidget`** (item 2) for the 5 enrichment crons.
- Add link tile in `AdminOpsCenter` and a tab inside `OutreachObservability`.

### 5. Cron/worker health monitor (missing-row detection)

Today `cron-sentinel` only checks watchlisted crons exist. Add an **expectation registry** that flags missing rows.

- New table `cron_expected_jobs` (jobname, surface, owner, critical bool) — seeded with all enrichment + alerting + walker crons.
- New edge function `cron-health-monitor` (every 15 min cron):
  1. Left-join `cron_expected_jobs` against `cron.job` — any missing → critical alert with `surface` name in payload.
  2. For each present job: detect `consecutive_failures >= 3` or `last_success_at` older than `stale_after_minutes` → critical alert.
  3. Writes to `outreach_alerts_log` with `kind='cron_missing'` or `kind='cron_failing'`, respects quiet-hours rule (warn suppressed 9pm–7am ET, critical always sends).
- UI: `CronStatusWidget` shows a red "MISSING" badge for expected-but-absent jobs with one-click link to the migration.

### 6. Decision audit logging (budget caps, quiet-hours, DLQ aging)

Single append-only table `enrichment_decision_audit`:
```
id uuid pk, decided_at timestamptz default now(),
decision_kind text,        -- 'walker_budget_block' | 'quiet_hours_suppress' | 'dlq_aged_to_suppression'
prospect_id uuid null,
surface text,              -- 'enrichment-matrix-walker' | 'outreach-alert-evaluator' | 'enrichment-backfill-nightly'
reason text,
context jsonb              -- spend snapshot, alert kind+severity, dlq age days, etc.
```

Wired into:
- `enrichment-matrix-walker` — log every prospect skipped because `daily_spend >= daily_budget_usd` with the spend snapshot.
- `outreach-alert-evaluator` — log every alert suppressed by quiet-hours, including severity, kind, ET time.
- `enrichment-backfill-nightly` — log each DLQ row aged into suppression with age_days + dlq reason.

UI: new "Decisions" tab on Wave 5 dashboard with filters by kind/prospect/surface and CSV export. Per-prospect view added to existing `EnrichmentDLQPanel` row drawer so you can trace a prospect's full decision history.

### 7. Alert rule tester (dry-run simulator)

New edge function `alert-rule-tester` + new component `src/components/admin/AlertRuleTesterPanel.tsx` mounted as a tab on the Wave 5 dashboard.

Inputs:
- **Spend anomaly**: enter today's spend + (optional) override 7-day average → returns whether cost-anomaly alert would fire and the computed ratio.
- **Quiet hours**: enter severity + ET time → returns suppress/send and reason.
- **DLQ aging**: enter prospect's DLQ entry date + reason → returns whether suppression would trigger and what reason code.

The function reuses the exact predicates from `outreach-alert-evaluator` and `enrichment-backfill-nightly` (extracted into `_shared/alert-rules.ts`) so tester == production. Results render inline; nothing is written to live tables (audit/log writes are skipped via a `dry: true` flag).

### 8. "Re-run enrichment" button (confidence-ordered)

- Add a button to `EnrichmentDLQPanel` and to a new section on the Wave 5 dashboard: "Re-run lowest-confidence prospects".
- Inputs: limit (default 100), min/max confidence range, optional trade/city filter.
- Calls a new edge function `enrichment-rerun-batch` that:
  1. Selects prospects ordered by `enrichment_confidence ASC NULLS FIRST` (lowest first), filtered by inputs.
  2. For each: pushes through `lead-enrichment-waterfall` with `force=true`.
  3. Tallies `updated` (confidence improved or new contact found), `skipped` (provider budget block / suppressed), `suppressed` (newly moved to suppression).
  4. Writes a summary row to `enrichment_run_progress` and returns the tally.
- UI shows live progress (poll `enrichment_run_progress` every 2s) and final toast: "Updated 47 / Skipped 12 / Suppressed 3".

---

## Technical notes

- **Migrations**: 1 SQL file adding `enrichment_e2e_checks`, `cron_expected_jobs`, `enrichment_decision_audit`, indexes (`outreach_alerts_log(severity, created_at)`, `enrichment_decision_audit(decision_kind, decided_at)`, `enrichment_dead_letter(created_at)`), RLS (admin-only via `has_role`), seed `cron_expected_jobs` with current enrichment/alerting/walker crons.
- **New edge functions**: `cron-health-monitor`, `alert-rule-tester`, `enrichment-rerun-batch`. Plus extensions to `enrichment-e2e-verify`, `enrichment-matrix-walker`, `outreach-alert-evaluator`, `contractor-outreach-enrich-backfill`.
- **Shared module**: `supabase/functions/_shared/alert-rules.ts` — extracted predicates so tester and live evaluator share one source of truth.
- **New cron**: `cron-health-monitor-15m` via `safe_cron_schedule` per the cron migration mandate.
- **Frontend**: `Wave5Dashboard.tsx`, `CronStatusWidget.tsx`, `AlertRuleTesterPanel.tsx`, `RerunEnrichmentDialog.tsx`; new tabs in `OutreachObservability.tsx`; tile in `AdminOpsCenter`.
- **Runbook**: append "Wave 7" section to `docs/enrichment-runbook.md` documenting tester, rerun button, and decision-audit query examples.

## Out of scope

- Renaming or restructuring existing Wave 5/6 panels.
- Changing alert delivery channels (still SMS via `_shared/twilio.ts` + email).
- Backfilling historical decision audit (starts logging from deploy).
