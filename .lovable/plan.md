

## Finish Apify Plan + Test Talent Radar Enrichment

Two remaining items + the requested test.

### Step 1 — Create missing `apify_run_batches` table (BLOCKER)

The dispatcher and webhook handler both write to this table, but the migration was never created. Without it, every scanner run fails at `INSERT INTO apify_run_batches`.

Migration: `supabase/migrations/<timestamp>_apify_run_batches.sql`

Columns (matching what the code already reads/writes):
- `batch_id text PRIMARY KEY`
- `run_at timestamptz default now()`
- `miosha_run_id text`, `indeed_run_id text`, `linkedin_run_id text`
- `miosha_status text`, `indeed_status text`, `linkedin_status text` (default `'pending'`)
- `candidates_found int default 0`
- `alerts_fired_at timestamptz`
- `created_at timestamptz default now()`

RLS enabled, service_role full access (no client reads needed — admin-only via edge fn).

### Step 2 — Steps 7 & 8 from original plan

Audit confirms `scanMiPLUS` / `scanMichiganOpenData` aren't named in the current scanner — the architecture has moved on (LARA VAL enumeration + fast-scanner already cover this per memory). **Skipping as obsolete.** Will note this in the plan file so it doesn't get re-flagged.

### Step 3 — Test Talent Radar enrichment end-to-end

Per `mem://tech/talent-radar-enrichment-v5`, the goal is measuring which APIs (NinjaPear, Crustdata, PDL, Apify LinkedIn) actually produce contact info for MIOSHA/permit-sourced trade candidates.

Test sequence (using `supabase--curl_edge_functions` + `supabase--read_query`):
1. Pick 5 recent `hire_alert_candidates` rows that lack phone/email
2. Invoke `candidate-deep-enrich?ids=<id1,id2,...>&force=1`
3. Read enrichment results: which stages fired, which returned phone/email, time per candidate
4. Invoke `hire-alert-scanner` once to confirm the new `apify_run_batches` insert works (dispatcher exits ~3s)
5. Tail logs from `apify-results-handler` to confirm no errors on the table write path
6. Report pass/fail per stage with concrete numbers

### Step 4 — Update `.lovable/plan.md`

Mark all 9 steps complete, note Steps 7/8 obsolete, add test results.

---

### Files touched
- **Create:** `supabase/migrations/<ts>_apify_run_batches.sql`
- **Edit:** `.lovable/plan.md` (status update + test results appended)

### What you do after
Nothing. Apify webhook is already configured with the `?secret=` query param. Test results will tell us if any enrichment stage is dead weight worth removing.

