

## Plan: Cron Safety Layer — Phase 2 (Dry-Run, Audit Log, Stale Window Per-Job)

Three additions on top of the existing safety layer. No breaking changes.

### 1. Dry-run mode for `safe_cron_schedule`

Add a new SQL function `public.safe_cron_validate(jobname, schedule, command)` — runs the **exact same validation** as `safe_cron_schedule` (forbidden-pattern checks, canonical URL check, Bearer length check, schedule format check) and returns a JSON result instead of scheduling:

```json
{ "ok": true, "warnings": [], "would_replace": { "schedule": "...", "command": "..." } }
```

or on failure:

```json
{ "ok": false, "error": "safe_cron_validate: forbidden vault lookup ...", "rule": "vault_supabase_url" }
```

Refactor: extract all validation logic from `safe_cron_schedule` into a private helper `_validate_cron_command(jobname, schedule, command)` returning `(ok boolean, error text, rule text)`. Both `safe_cron_schedule` and `safe_cron_validate` call it. Zero duplication.

**UI surface**: New tab section "🧪 Dry-Run Validator" inside `AdminCronStatus.tsx`:
- Three inputs: jobname, schedule, command (textarea)
- "Validate" button calls a new edge function `cron-validate` (admin-gated) which invokes `safe_cron_validate` RPC
- Shows green ✅ pass with the would-replace diff, or red ❌ with the rule that failed and a one-line fix hint

### 2. Audit log of every `safe_cron_schedule` attempt

New table `public.cron_schedule_audit`:

```text
├── id              uuid PK
├── jobname         text
├── schedule        text
├── command         text
├── attempted_by    text       (current_user / auth.uid() if available)
├── outcome         text       ('success' | 'rejected' | 'rolled_back')
├── error_rule      text       (which rule fired, e.g. 'vault_supabase_url')
├── error_message   text
├── mode            text       ('schedule' | 'validate' | 'rollback')
└── attempted_at    timestamptz default now()
```

Populated automatically by:
- `safe_cron_schedule` — INSERT row at start, UPDATE outcome on success/failure (uses `EXCEPTION WHEN OTHERS` block to capture rejections)
- `safe_cron_validate` — INSERT with `mode='validate'`
- `rollback_cron` — INSERT with `mode='rollback'`

RLS: SELECT for admins, INSERT/UPDATE for service_role only.

**UI surface**: New "📜 Audit Log" section at the bottom of `AdminCronStatus.tsx`:
- Last 50 attempts, newest first
- Columns: timestamp, mode (badge), jobname, outcome (✅/❌/↩), error_rule (chip), attempted_by, expandable command
- Filter chips: All / Rejected only / Last 24h
- Backed by extending the existing `cron-status` edge function to also return `audit: [...]`

### 3. Per-job stale window from cron expression

Currently Sentinel uses a hardcoded 26-hour staleness threshold for everything — wrong for a 4h cron, generous for a weekly cron.

Add a small Deno helper `supabase/functions/_shared/cron-window.ts`:

```text
parseCronWindow(expr) -> { intervalMinutes: number, staleAfterMinutes: number, nextRunAt: Date }
```

Logic:
- Parse standard 5-field cron expressions (minute, hour, dom, month, dow)
- Detect canonical patterns: `*/N * * * *` → N minutes; `0 */N * * *` → N hours; `0 H * * *` → 24h; `0 H * * D` → 7d; `0 H D * *` → ~30d
- `staleAfterMinutes = intervalMinutes * 2 + 30` (give one full cycle of slack + 30 min grace)
- `nextRunAt`: walk forward minute-by-minute (capped at 60 days lookahead) checking each field — small helper, no external deps
- Fallback: if expression doesn't parse, return `{ intervalMinutes: 1440, staleAfterMinutes: 1560 }` (24h + slack)

Wire into `cron-sentinel`:
- For each job in scan, call `parseCronWindow(job.schedule)`
- Replace hardcoded 26h staleness check with per-job `staleAfterMinutes`
- Upsert `next_run_at = parseCronWindow(...).nextRunAt` and a new column `expected_interval_minutes` into `cron_job_health`

Migration adds two columns to `cron_job_health`:
```text
expected_interval_minutes int
stale_after_minutes int
```

**UI surface**: `AdminCronStatus.tsx` table additions:
- New column "Expected gap" — shows `Every 4h`, `Every 24h`, `Every 7d` (formatted from `expected_interval_minutes`)
- "Next Run" column gets a relative timestamp ("in 2h 14m") plus absolute time on hover
- Stale jobs (now() > last_success_at + stale_after_minutes) get an amber dot instead of green
- KPI "Stale" count uses the new per-job threshold

### Files to create / edit

| File | Change |
|---|---|
| `supabase/migrations/<ts>_cron_safety_phase2.sql` | **New** — `_validate_cron_command` helper, `safe_cron_validate` function, `cron_schedule_audit` table + RLS, two new columns on `cron_job_health`, refactor `safe_cron_schedule` to use helper + write audit rows |
| `supabase/functions/_shared/cron-window.ts` | **New** — cron expression parser + next-run computer |
| `supabase/functions/cron-validate/index.ts` | **New** — admin-gated, calls `safe_cron_validate` RPC |
| `supabase/functions/cron-status/index.ts` | Extend response payload with `audit: [...]` + `expected_interval_minutes` per job |
| `supabase/functions/cron-sentinel/index.ts` | Use `parseCronWindow()` for per-job staleness; upsert `next_run_at` + `expected_interval_minutes` |
| `src/components/dwa-admin/AdminCronStatus.tsx` | Add Dry-Run Validator section, Audit Log section, Expected Gap column, relative-time Next Run |
| `mem://tech/cron-safety-layer.md` | Update — document `safe_cron_validate`, `cron_schedule_audit`, per-job stale window |

### RLS

- `cron_schedule_audit`: SELECT for admins, INSERT/UPDATE for service_role only

### Out of scope

- No Slack/Discord webhook on rejected validations (audit log is the trail)
- No client-side dry-run for schedules generated by other tools (only the admin UI form)
- No retroactive backfill of audit log for the existing 100+ crons — starts now

