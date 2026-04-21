

## Plan: Cron Health & Safety Layer

Build a defense-in-depth system around cron scheduling so silent failures (like the vault-lookup NULL bug that killed 21 crons for weeks) become impossible to ship and trivial to debug.

### 1. Server-side guard: SQL function that REJECTS bad cron schedules

New migration creates `public.safe_cron_schedule(jobname, schedule, command)` — a `SECURITY DEFINER` wrapper that:

- Validates `command` does NOT contain forbidden patterns:
  - `current_setting('app.supabase_url')`
  - `vault.decrypted_secrets WHERE name = 'SUPABASE_URL'`
  - `vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY'`
  - Literal `NULL` substituted into `url :=` or `Authorization`
- Validates command contains the canonical hardcoded URL `https://eauvubfpanpeuxsrqesu.supabase.co`
- Validates command contains an `Authorization: Bearer eyJ...` header (length ≥ 100 chars after Bearer)
- On any failure: `RAISE EXCEPTION 'safe_cron_schedule: <reason>'` — migration aborts, never deploys
- Before scheduling: snapshots the previous job (if exists) into `cron_schedule_history`, then `cron.unschedule` + `cron.schedule`

All future cron migrations call `PERFORM safe_cron_schedule(...)` instead of raw `cron.schedule(...)`. Updates `mem://tech/cron-sentinel-and-monitoring.md` to mandate this.

### 2. Versioning + rollback table

New table `public.cron_schedule_history`:

```text
├── id              uuid PK
├── jobname         text
├── schedule        text       (cron expression)
├── command         text       (full SQL command)
├── replaced_at     timestamptz default now()
├── replaced_by     text       (current_user)
└── active          boolean    (true = currently scheduled)
```

Every call to `safe_cron_schedule` archives the prior version (`active=false`) and inserts the new one (`active=true`).

New function `public.rollback_cron(jobname text)` — finds the most recent inactive history row for that job, calls `safe_cron_schedule` with those values, flips `active` flags. One-click revert.

### 3. Cron health tracking table

New table `public.cron_job_health`:

```text
├── jobname               text PK
├── last_success_at       timestamptz
├── last_failure_at       timestamptz
├── last_error            text
├── next_run_at           timestamptz   (computed from cron expression + now)
├── consecutive_failures  int default 0
├── total_runs            int default 0
└── updated_at            timestamptz
```

Populated two ways:
- **Pull**: `cron-sentinel` (already runs every 6h) reads `cron.job_run_details` for each watchlist job, upserts latest success/failure/error into `cron_job_health`. Computes `next_run_at` using a small `pg_cron` expression parser (cron-parser deno lib in the edge function).
- **Push**: any edge function fired by cron writes `last_success_at = now()` to its own row at the end of a successful run (optional, additive — Sentinel pull is the source of truth).

### 4. Admin "Cron Status" screen

New component `src/components/dwa-admin/AdminCronStatus.tsx` — added as a tab in `/dwa-admin`:

- **Top KPI strip**: Total jobs / Healthy / Failing / Stale (no run in expected window)
- **Failing jobs table** (red): jobname, `last_error` (truncated, expandable), `last_failure_at`, `consecutive_failures`, current `command` (collapsed `<details>`), **Rollback** button
- **All jobs table**: jobname, schedule, `last_success_at`, `next_run_at`, `total_runs`, `Show command` button
- Rollback button calls a new edge function `cron-rollback` (admin-only) which invokes `public.rollback_cron(jobname)` and refreshes the table.

Backed by a new edge function `cron-status` (admin-gated via `has_role`):
- Reads `cron.job` joined with `cron_job_health` and most recent 5 rows from `cron.job_run_details`
- Returns a single JSON payload the React component renders

### 5. Wire Sentinel into the new tables

Update `supabase/functions/cron-sentinel/index.ts`:
- After existing watchlist scan, query `cron.job_run_details` for last run of each watchlist job (last 24h)
- Upsert into `cron_job_health` with `last_success_at` / `last_failure_at` / `last_error` / `consecutive_failures`
- Compute `next_run_at` from cron expression
- Existing SMS/email alert flow unchanged — but the Cron Status screen now has the receipts

### Files to create / edit

| File | Change |
|---|---|
| `supabase/migrations/<ts>_cron_safety_layer.sql` | **New** — `safe_cron_schedule`, `rollback_cron`, `cron_schedule_history`, `cron_job_health` tables + RLS (admin-only SELECT, service_role full access) |
| `supabase/functions/cron-sentinel/index.ts` | Extend to upsert `cron_job_health` from `cron.job_run_details` |
| `supabase/functions/cron-status/index.ts` | **New** — admin-gated read endpoint |
| `supabase/functions/cron-rollback/index.ts` | **New** — admin-gated rollback trigger |
| `src/components/dwa-admin/AdminCronStatus.tsx` | **New** — Cron Status tab UI |
| `src/pages/DWAAdmin.tsx` | Add "🛡️ Cron Status" tab |
| `mem://tech/cron-sentinel-and-monitoring.md` | Update — mandate `safe_cron_schedule()` for ALL future cron migrations; add 4th absolute ban (raw `cron.schedule` outside of approved wrapper) |
| `mem://index.md` | Add reference to new "Cron Safety Layer" memory |
| `mem://tech/cron-safety-layer.md` | **New** — describes the wrapper function, history table, rollback flow, health table |

### RLS

- `cron_schedule_history`: SELECT for admins, INSERT/UPDATE for service_role only
- `cron_job_health`: SELECT for admins, INSERT/UPDATE for service_role only

### Out of scope (not doing unless asked)

- No automatic rollback on Sentinel alert (Matt approves manually via the Cron Status button — automatic rollback could mask a real bug)
- No Slack/Discord webhook for cron alerts (SMS + email already exist)
- No backfill of `cron_schedule_history` for the 100+ existing crons — starts tracking from migration forward
- No UI for `cron_schedule_history` browsing beyond the most-recent rollback target (can add later if Matt needs full audit trail)

