User's question: pg_cron jobs were rebuilt with the safe `vault.decrypted_secrets` pattern but Sentinel still reports 21/23 dormant. Why and can we fix it?

Let me investigate before planning. Key suspects:

1. `pg_cron` extension may not actually be enabled, OR jobs were created in a schema/role that pg_cron can't execute
2. The vault migration may have run but the `cron.schedule()` calls inside the DO block may have silently no-op'd if `v_url`/`v_key` came back NULL (vault secrets not actually present under those exact names)
3. Sentinel watchlist names don't match real cron names → reports false "missing"
4. Jobs scheduled but `cron.job_run_details` empty because pg_cron worker isn't running on this Supabase tier
5. The `net.http_post` calls fire but Edge Functions reject them (auth header malformed)

Need to verify with read-only queries before proposing a fix.

## Investigation Plan (read-only first)

1. Query `cron.job` — list every job, schedule, active flag, command preview, username
2. Query `cron.job_run_details` — last 50 runs, status, return_message — see if pg_cron is firing AT ALL or if specific jobs error
3. Query `vault.decrypted_secrets` — confirm `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` exist under those exact names (this is the #1 likely failure — the migration assumed names that may not match what's in vault)
4. Query `pg_extension` — confirm `pg_cron` + `pg_net` actually enabled
5. Query `net._http_response` — see if http_post calls are succeeding or returning errors
6. Check Sentinel watchlist vs `cron.job.jobname` — name mismatches
7. Spot-check 2-3 edge function logs (`hire-alert-scanner`, `industry-pulse-scanner`) — did they receive ANY invocations in last 48h?

## Then Fix Plan (default mode after approval)

Based on what investigation finds, fix will be ONE of these (most likely #A):

**A. Vault secret names don't match** (most likely — explains why ALL rebuilt crons silent)

- The DO block in `20260418004827_*.sql` does `WHERE name = 'SUPABASE_URL'` — if vault stores it under a different name (e.g., `supabase_url` lowercase, or doesn't have it at all), `v_url` is NULL → `cron.schedule()` schedules with literal `NULL/functions/v1/...` URL → every fire is a no-op
- Fix: new migration that (1) confirms/inserts correct vault entries, (2) re-runs `cron.schedule()` for all 20 jobs with verified non-NULL URL/key
- Add a safety guard: `IF v_url IS NULL THEN RAISE EXCEPTION` so future migrations fail loud instead of silently scheduling broken crons

**B. pg_cron disabled or wrong role**

- Migration to `CREATE EXTENSION IF NOT EXISTS pg_cron` and re-grant
- Re-schedule under `postgres` role explicitly

**C. Edge functions rejecting the cron's auth header**

- Inspect `verify_jwt` in `config.toml` for each function
- If function requires JWT and cron sends service-role key as bearer, that's fine — but if function does its own auth check that rejects service role, fix function

**D. Sentinel watchlist mismatch only** (cosmetic — crons actually working but Sentinel wrong)

- Update `WATCHLIST` in `cron-sentinel/index.ts` to match real `jobname` values from `cron.job`

**E. Hardcoded fallback** (defense in depth)

- Replace vault lookup with hardcoded `https://eauvubfpanpeuxsrqesu.supabase.co` for the URL (URL never rotates) — eliminates an entire failure mode. Service role key still pulled from vault since it can rotate.

### Deliverables

- Investigation memo in chat: exact root cause with evidence (which query proved it)
- One migration file fixing the cron creation + adding NULL guards
- If E chosen: also patch `cron-sentinel` watchlist to match real names
- Manual `SELECT cron.schedule(...)` triggers to fire 3 critical jobs immediately so user sees data within minutes, not 24h
- Update `mem://tech/cron-sentinel-and-monitoring.md` with the new "vault name mismatch" failure mode + the NULL-guard pattern (so this becomes failure #3 in the burn book)
- Re test to see if the crons are fixed,  if not then, re do the entire process but from a different approach until the 21 other cron Jobs are fixed.

### Out of Scope

- No new product features
- No Sentinel UI changes beyond watchlist name alignment
- No re-architecting the fix-broken-crons migration history — just one new migration on top