## What I found

The `mortgage-radar-am-digest` cron is scheduled correctly (11:30 UTC daily, active), but **the last 2 days both failed at the pg_cron layer** before the function was even invoked:

```
2026-05-11 11:30  failed  "job startup timeout"   ← today
2026-05-10 11:30  failed  "job startup timeout"   ← yesterday
2026-05-09 11:30  succeeded
2026-05-08 11:30  succeeded
2026-05-07 11:30  succeeded
```

This is **not a mortgage-radar bug**. It's a project-wide pg_cron background-worker exhaustion. In the last 36 hours, every high-frequency cron is failing with the same "job startup timeout" error:

| Job | Failures (36h) |
|---|---|
| process-email-queue | 547 |
| queue-worker-enrich-1m | 305 |
| queue-worker-scrape-1m | 304 |
| release-pending-sms-every-minute | 295 |
| outreach-queue-worker-every-minute | 285 |
| auto-draft-on-inbound-every-minute | 260 |
| …15+ more every-minute jobs | … |

pg_cron has a fixed worker pool (`max_worker_processes` / `cron.max_running_jobs`). Once it's saturated by long-running `net.http_post` calls from every-minute workers, lower-frequency jobs like the daily 11:30 digest can't acquire a worker and Postgres reports "job startup timeout" — the SQL never runs at all. Once the daily slot is missed, pg_cron does not retry until the next scheduled time.

## The fix

### Step 1 — Recover today's digest immediately
Manually invoke `mortgage-radar-am-digest` via `supabase--curl_edge_functions` so today's email goes out now. This is a one-shot HTTP call, no migration required.

### Step 2 — Stop the worker-pool saturation (root cause)
Audit the every-minute / every-2-minute jobs above. Most of them are queue drainers that should either:
- be consolidated (one orchestrator that fans out to multiple queues internally), or
- be moved to fire-and-forget (`net.http_post` returns immediately; the timeout is happening because pg_cron is waiting on the worker slot, not the HTTP response, but the slot is held while `pg_net` waits on its response queue).

Specifically, the worst offenders (`process-email-queue` at 547/36h = every ~4min failing, plus 6 every-minute workers all failing) should be:
1. Verified that they actually need to run every minute (most queues are empty 95% of fires).
2. Stretched to every 2–5 minutes where business-acceptable.
3. Or migrated to a single "queue-orchestrator-1m" job that calls multiple drain endpoints in one SQL invocation.

### Step 3 — Add a safety net for daily digests
Add a second cron entry for `mortgage-radar-am-digest` that runs at 11:35 UTC as a retry, gated by a "did today's digest already send?" check inside the function (idempotent — the function already writes a log row per send). This way, even if 11:30 misses its worker, 11:35 catches it. Apply the same pattern to `trade-radar-am-digest` and `mortgage-radar-scanner-daily` (which I should verify also missed today).

### Step 4 — Add cron-sentinel coverage for "job startup timeout"
The existing `cron-sentinel` watchdog (per memory: 6h check, SMS Matt on critical failure) checks freshness + output pulse but likely doesn't classify "job startup timeout" as a critical class. Confirm and, if needed, add a rule: "if the same daily job hits startup-timeout 2 days in a row → SMS Matt."

## Technical notes

- Project-wide impact: today's missed digest is the visible symptom; underneath, hundreds of queue-worker fires are also missing. Email queue, SMS release, outreach drafts, and signal correlation are all degraded.
- I'd verify `mortgage-radar-scanner-daily` (11:00 UTC today) also missed before invoking the digest — if both missed, scanner needs to run first so the digest has fresh leads.
- No schema changes needed for Step 1 or Step 3 (cron-only migration). Step 2 likely requires editing 2–4 worker functions to consolidate.

## Proposed order of operations
1. Curl-invoke `mortgage-radar-scanner-daily` then `mortgage-radar-am-digest` → today's email goes out within ~5 min.
2. Ship migration adding the 11:35 UTC retry job (+ same for trade-radar) and idempotency check.
3. Audit + stretch / consolidate the every-minute drainers.
4. Extend cron-sentinel rule and verify it fires on the next simulated miss.

Approve and I'll execute in that order.