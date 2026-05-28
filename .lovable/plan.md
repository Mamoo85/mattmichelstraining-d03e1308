## Plan: Trading inventory + SMS spam fixes

### Step 1 — Store the secondary Supabase PAT safely

Best option: save it as a project secret named `SECONDARY_SUPABASE_ACCESS_TOKEN` via the secure secret form (you paste once, I never see it in chat, and it's available to edge functions / scripts if we ever need it). 

- I'll trigger `add_secret(["SECONDARY_SUPABASE_ACCESS_TOKEN"])` — a secure form will pop up for you to paste it.
- I will NOT log it, echo it, or store it in any file.
- For this session I'll use it via `Authorization: Bearer $SECONDARY_SUPABASE_ACCESS_TOKEN` against the Supabase Management API (`https://api.supabase.com/v1/projects/zmyczlfuufhngzovkjdh/...`) to list functions, read DB schema, pull logs.

If you'd rather not store it long-term, say "session-only" and I'll just use it once and ask you to revoke it after.

### Step 2 — Trading project inventory (track A, runs in background)

Against `zmyczlfuufhngzovkjdh` using the PAT, produce a single report covering:

1. **Edge functions list** — names, last deploy, verify_jwt, recent invocation count (Management API `/v1/projects/{ref}/functions`).
2. **Database schema** — every table, row count, RLS status. Look specifically for: kalshi_*, robinhood_*, trades, positions, orders, market_*, signals, backtests.
3. **Cron jobs** — `cron.job` + last 24h `cron.job_run_details` status.
4. **Secrets present** — names only (Kalshi/Robinhood/Alpaca/Plaid keys).
5. **Recent errors** — last 50 function errors + last 50 Postgres errors.
6. **Auth users** — count + any admin role rows.

Output: one markdown summary saved to `/mnt/documents/trading-inventory.md` so you can read/share it. No code changes to the trading project this turn — read-only.

### Step 3 — Fix the 3 SMS-spamming scanners on PRIMARY (track B, in parallel)

For each of:
- `industry-pulse-scanner` (feeds `industry-pulse-commercial-3am-et` watchdog)
- `contractor-prospector` (feeds `contractor-prospector-daily` watchdog)
- `dead-lead-pool-refresh` (5 sources all returning 0)

Workflow per function:
1. Pull last 50 invocation logs (`edge_function_logs`) + last 7d run rows from its output table.
2. Curl the function once to capture HTTP code + body.
3. Read source, identify why it's writing 0 rows (typical suspects: expired API key, schema drift, source URL 404, silent try/catch).
4. Apply minimum fix (real fix, not a kill switch). Examples of acceptable fixes: swap dead source, repair query, add missing await, fix vault-key name, add structured run row even on 0-output so the watchdog stops false-firing.
5. Deploy via `supabase--deploy_edge_functions`.
6. Re-curl and confirm output row written.

Per CLAUDE.md "no kill switch" rule — these are real silent failures, fixes will restore output, not suppress alerts.

### Step 4 — Report

Single message with:
- Trading inventory summary (link to `/mnt/documents/trading-inventory.md`)
- 3 SMS fixes: before → after row counts, commits made
- Anything in trading project that needs your input (missing keys, dead crons, etc.)
- Recommended next session (e.g. "give me GitHub access to trading repo so I can read the code that wrote these tables")

### Technical notes

- The PAT only reaches secondary project + trading project (same Supabase account). Primary (`eauvubfpanpeuxsrqesu`) is Lovable-managed and unaffected — I'll use existing tooling there.
- All Management API calls go through `https://api.supabase.com/v1/...` with `Authorization: Bearer <PAT>`.
- Secret name `SECONDARY_SUPABASE_ACCESS_TOKEN` chosen to be obvious in the secret list and not collide with primary tooling.
- Trading inventory is read-only; no migrations, no deploys to trading this turn.

### What I need from you to start

Just approve. After approval I'll:
1. Trigger the secure secret form for `SECONDARY_SUPABASE_ACCESS_TOKEN`
2. Once you paste, immediately start both tracks in parallel.