---
name: Cron Safety Layer
description: SQL wrapper + dry-run + audit log + per-job stale windows for all pg_cron scheduling
type: feature
---

# Cron Safety Layer

Defense-in-depth around `cron.schedule()`. Lives in `public.safe_cron_schedule`, `public.safe_cron_validate`, `public.rollback_cron`, plus three tables (`cron_schedule_history`, `cron_job_health`, `cron_schedule_audit`). Backed by `/dwa-admin → 🛡️ Cron Status`.

## Mandatory pattern for all new cron migrations

```sql
PERFORM public.safe_cron_schedule(
  'job-name',
  '0 * * * *',
  format($job$SELECT net.http_post(url := %L, headers := %L::jsonb, body := '{}'::jsonb);$job$,
    'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/my-fn', v_hdr)
);
```

The wrapper rejects, at deploy time:
- `current_setting('app.supabase_url')` (returns NULL in pg_cron)
- **Any `vault.decrypted_secrets WHERE name = 'X'` reference where `X` doesn't exist or is empty in this project's vault** (rule: `vault_key_missing`). Validated dynamically via `_vault_key_exists(name)` + regex-extracted via `_extract_vault_keys(command)` — catches Phase 17/20 bug class for any future vault key, not just `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`.
- Literal `NULL` in `url :=` or `Bearer NULL`
- Missing canonical URL `https://eauvubfpanpeuxsrqesu.supabase.co`
- Missing/short Bearer token (must be `eyJ...` 100+ chars)
- Missing/empty/non-5-field schedule

**Note**: the only vault key that currently exists in this project is `email_queue_service_role_key`. All other secrets are env vars on edge functions, not vault entries.

On rejection: `RAISE EXCEPTION` aborts the migration. On success: archives prior `cron_schedule_history` row to `active=false`, inserts new `active=true`, runs `cron.unschedule` + `cron.schedule`.

## Dry-run: `safe_cron_validate(jobname, schedule, command)`

Returns JSON `{ok, error?, rule?, would_replace?, new?}` without touching pg_cron. UI: `/dwa-admin → 🛡️ Cron Status → 🧪 Dry-Run Validator`. Backed by edge function `cron-validate` (admin-gated).

## Audit log: `cron_schedule_audit`

Every call to `safe_cron_schedule`, `safe_cron_validate`, and `rollback_cron` writes a row: `mode` ∈ {schedule, validate, rollback}; `outcome` ∈ {success, rejected, rolled_back, pending}; `error_rule` + `error_message` on rejection; `attempted_by = current_user`. UI: `/dwa-admin → 🛡️ Cron Status → 📜 Audit Log` (filters: All / Rejected / Last 24h).

## Per-job stale window

`cron-sentinel` uses `parseCronWindow(schedule)` from `supabase/functions/_shared/cron-window.ts` to compute per-job `expected_interval_minutes` and `stale_after_minutes = interval * 2 + 30`. Replaces the old hardcoded 26h threshold. Stored on `cron_job_health`. UI shows "Expected gap" column + relative "Next Run" timestamp; stale jobs get amber dot, failing jobs get red dot, healthy green.

## Rollback

`rollback_cron(jobname)` finds most recent `active=false` history row, calls `safe_cron_schedule` with those values, writes a `mode=rollback` audit row. One-click revert from the Failing Jobs table.
