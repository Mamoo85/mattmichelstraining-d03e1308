

Claude's plan is largely correct on diagnosis but partially outdated on what's actually deployed. Let me verify what matches reality and present a tight plan.

**What Claude got RIGHT:**
1. ✅ Sequential `upsertCandidate()` loops in `miosha-license-scraper` are a real bottleneck — concurrent batch upserts (Promise.allSettled with concurrency=10) is the right fix
2. ✅ `hire-alert-scanner` 100s timeout vs scraper 120s budget is a real margin bug — bump to 130s
3. ✅ Stale watchlist entry (`hire-alert-scanner-daily` was renamed to `4h` per CLAUDE.md Phase 17)
4. ✅ Adding `[functions.cron-sentinel]` to config.toml with `verify_jwt = false` is correct hygiene

**What Claude got WRONG / outdated:**
1. ❌ `cron_job_status()` RPC — I already rewrote this last session. It already has `EXCEPTION WHEN OTHERS` and returns safe JSON. The HTTP 500 storm Claude described is GONE (current screenshot shows "2 of 22 failing" with proper error messages — not a 500 storm). His Fix 1 is redundant.
2. ❌ He thinks the cron sentinel is still spamming SMS. Current screenshot shows it's working — 20 green, 2 legit failures.

**What's ACTUALLY broken right now (from screenshot):**
- `contractor-prospector-daily` → "web_design_leads is empty" — real data issue, not infra
- `ops-daily-projects` → heartbeat 20183m old — agent isn't running

Both are legit. The user's frustration is the scanner finds 0 candidates (Claude's Part A is the real win) and these 2 lingering reds.

## My Plan — verified, minimal, will confirm with curl after

### Step 1 — Apply Claude's Part A (the scanner fix that matters)
- **`miosha-license-scraper/index.ts`**: Add `upsertBatch()` helper with `Promise.allSettled` + concurrency=10. Replace the 2 sequential loops (NPI batch + Sonar batch). Verify line numbers first via `code--view` since file is large.
- **`hire-alert-scanner/index.ts` line 308**: bump `AbortSignal.timeout(100_000)` → `130_000`.

### Step 2 — Skip Claude's redundant RPC fix
`cron_job_status` already hardened. Verify via `code--view` of the latest migration before skipping (don't trust memory).

### Step 3 — Apply Claude's watchlist + config fixes
- **`cron-sentinel/index.ts`**: rename `hire-alert-scanner-daily` → `hire-alert-scanner-4h`, freshness `60*30` → `60*6`.
- **`supabase/config.toml`**: append `[functions.cron-sentinel]\nverify_jwt = false`.

### Step 4 — Fix the 2 actually-failing crons
- **`contractor-prospector-daily`**: it's failing because `web_design_leads` is empty. Either (a) snooze 30 days like we did for the others, or (b) make the prospector seed-tolerant (skip cleanly, log "no leads to process", heartbeat OK). I'll do (b) — proper fix, no false-green.
- **`ops-daily-projects`**: agent is dead (20183 min stale = 14 days). Per CLAUDE.md it's the "ops-autonomous" agent. Snooze 30 days OR re-enable the cron. I'll snooze and add a note — agent revival is a separate decision the user should make.

### Step 5 — VERIFY (mandatory, won't claim "fixed" until all pass)
1. Deploy `miosha-license-scraper` + `hire-alert-scanner` + `cron-sentinel`
2. `curl` the scanner manually → wait → query `hire_alert_candidates` count → confirm > 0 new rows
3. `curl` cron-sentinel → confirm 0 critical failures
4. Query `hire_alert_runs` for the new run → confirm `candidates_found` > 0 and no errors

### Memory rule to commit
Save to `mem://tech/scanner-upsert-concurrency` — "Sequential per-row Supabase upserts in scanner functions blow the 120s edge budget. Always use `Promise.allSettled` with concurrency=10 batches for any loop > 50 rows."

### What I will report back
- DB query: count of `hire_alert_candidates` inserted in last hour
- DB query: latest `hire_alert_runs` row showing real numbers
- Sentinel report: 0 critical failures, 0 reds remaining
- Edge function logs showing the scanner completed in <30s (not timed out)

