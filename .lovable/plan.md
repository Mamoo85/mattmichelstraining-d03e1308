I found the problem behind the screenshot.

The cron itself is not dead anymore: `industry-pulse-commercial-3am-et` is currently scheduled and has been producing `industry-pulse-scanner` run logs daily at 07:00 UTC. The latest watchdog rows after the last fix are passing.

However, this has been noisy for a week because the monitoring stack had two design bugs:

1. The watchdog was checking `demand_radar_runs` globally, not the specific source for the cron. That let unrelated `demand-radar-enhanced-scan` rows confuse the check, and earlier it also produced a blank `count query failed:` message.
2. The alert email said “URL missing from cron schedule” because the watchdog depended on `cron_schedule_history` parsing and did not reliably use the live `cron.job` row as the source of truth.

Plan to fix this properly:

1. Harden `cron-zero-output-watchdog`
   - Add an optional `sourceFilter` per watched job.
   - For `industry-pulse-commercial-3am-et`, count only `demand_radar_runs.source = 'industry-pulse-scanner'`.
   - For enhanced Demand Radar checks, keep them separate from commercial Industry Pulse instead of mixing both under the same table.
   - Improve the error message so failed DB counts include the actual backend error text instead of blank `count query failed:`.

2. Stop relying only on `cron_schedule_history` for URLs
   - Add a small read-only RPC/function in a migration that safely returns the live `cron.job` command for a job name.
   - Update the watchdog to prefer the live cron command first, then fall back to `cron_schedule_history`, then fall back to the known function URL.
   - This prevents future emails from showing “URL missing from cron schedule” when the cron is active.

3. Repair cron health bookkeeping
   - Make sure `cron_schedule_history` has the current active row for `industry-pulse-commercial-3am-et`.
   - Make sure the live cron command and stored history command match.
   - Reset stale `cron_job_health` failure state for this job once the checks pass.

4. Reduce alert spam
   - Keep SMS dedupe, but add email dedupe for repeated identical watchdog failures so you don’t get the same false alarm every hour.
   - Include last successful output timestamp in the report so you can immediately see whether the job is actually stale.

5. Verify after changes
   - Deploy the changed watchdog function.
   - Run the watchdog manually and confirm it reports `failures: 0`.
   - Query recent `demand_radar_runs` and `cron_sentinel_alerts` to confirm the latest status is passing.
   - I will also confirm whether today’s Demand Radar / Industry Pulse scan produced output or is waiting for the next 07:00 UTC run.

Technical files/migrations involved:

- `supabase/functions/cron-zero-output-watchdog/index.ts`
- Likely a new migration for the safe `cron.job` command reader RPC and health cleanup
- Possibly `supabase/functions/cron-sentinel/index.ts` if the same source-specific filtering should be mirrored there too