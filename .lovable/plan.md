

## Root Cause (real this time)

The Sentinel report is RED on every cron because the RPC `cron_job_status` is hitting PostgREST's **8-second statement timeout** (`SQLSTATE 57014`) — not a permission issue. I confirmed by hitting the endpoint directly and got: `{"code":"57014","message":"canceling statement due to statement timeout"}` → HTTP 500.

Permissions ARE granted correctly (yesterday's migration worked). The function works when called from psql. But under PostgREST it times out because:

- `cron.job_run_details` has **only a primary-key index on `runid`** — no index on `jobid` or `start_time`
- With 100+ crons firing for months, that table is huge
- The `SELECT MAX(d.start_time) … JOIN cron.job` does a full table scan → exceeds 8s → 500

So my "fix" yesterday solved a real permission problem but a *different* problem (timeout) was hiding behind it. As pg_cron history grew, this got worse. Today every cron times out.

## The Fix (one migration, three things)

### 1. Add the missing index
```sql
CREATE INDEX IF NOT EXISTS idx_cron_job_run_details_jobid_start
  ON cron.job_run_details (jobid, start_time DESC);
```
This turns a sequential scan over millions of rows into an index seek of one row per cron. Query goes from 8s+ → <50ms.

### 2. Rewrite `cron_job_status` to be timeout-proof
- Use `ORDER BY start_time DESC LIMIT 1` (index-friendly) instead of `MAX()` over a join
- Add `SET LOCAL statement_timeout = '3s'` inside the function
- Wrap in `EXCEPTION WHEN OTHERS` → return `{exists: false, error: "<msg>"}` instead of letting PostgREST emit HTTP 500
- This way Sentinel sees the real reason ("timeout", "no such cron", etc.) instead of a generic 500

### 3. Trim old `cron.job_run_details` rows
One-time cleanup of run history older than 30 days (pg_cron never auto-prunes). Then add a weekly pruning cron so it never bloats again.
```sql
DELETE FROM cron.job_run_details WHERE end_time < now() - interval '30 days';
-- + weekly cron to keep it trimmed
```

## What you'll see after deploy
- Sentinel report goes from "20 of 22 failing" → real picture (probably 2-3 actually broken)
- The `contractor-prospector-daily` row already shows the correct error pattern ("web_design_leads is empty") so we know Sentinel CAN report real problems when the RPC works
- The "Failed to send a request to the Edge Function" error in DWA Overview (3rd screenshot) is a separate issue I'll check after — likely related to the `cron-sentinel` function timing out the same way

## Verification
1. Apply migration
2. `curl` the RPC directly → expect `{"active":true,"last_run":"…","exists":true}` in <100ms instead of 500
3. Click "Run Sentinel Now" in `/dwa-admin → Cron Sentinel` → expect mostly green
4. Check the DWA Overview "DWA Product Suite" panel — figure out which edge function the failing request is hitting

