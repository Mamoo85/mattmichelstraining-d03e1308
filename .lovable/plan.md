## Goal
Wire `_shared/talent-signals/extras-100.ts` (50-source `runExtraTalentSources` orchestrator) into `techalert-prospect-hunter` alongside the already-wired `extras-50`, so all 50 candidate sources are invoked every run with fail-soft behavior, and their counts appear in the `signals` payload of the run response + `techalert_hunter_runs` log.

## Current state
- `extras-50.ts` (`runAll50Sources`) — already wired (line 1155, 1185–1188). Returns `Posting[]` (company-level: `company_name`, `role`, `is_boiler`). Adds directly into the `supplemental` array → flows into `techalert_prospect_targets` upsert.
- `extras-100.ts` (`runExtraTalentSources`) — exists, exports a `Promise.allSettled` orchestrator over 50 scanners, but is **not imported** anywhere. Returns `ExtraPosting[]` (candidate-level: `full_name`, `current_employer`, `current_title`, `trade`, etc.). Most scanners are stubs returning `[]` until keys/credentials are added — that's the documented design (registered = discoverable).
- Shape mismatch is the blocker: an `ExtraPosting` cannot go into `techalert_prospect_targets` directly (no `company_name`/`role`).

## Plan

### 1. Adapter: ExtraPosting → Posting (in `techalert-prospect-hunter/index.ts`)
Add a small inline mapper that converts an `ExtraPosting` to the existing `Posting` shape only when minimum fields are present:
- `company_name` ← `current_employer` (skip if missing/empty)
- `role` ← `current_title || trade || "Trade Worker"`
- `city` ← `city`
- `is_boiler` ← `false` (extras-100 sources don't carry boiler signal; safe default)
- `source_url` ← `raw_data?.url` if present, else `undefined`
- `source_label` ← `extras100_<source>` for traceability
- `days_posted` ← omitted

Candidates without `current_employer` are dropped at the adapter (license-board licensee names with no employer aren't useful as company-level prospects yet — they'll start contributing once those scanners gain employer enrichment).

### 2. Wire into the parallel block
- Add `import { runExtraTalentSources }` lazy-import next to extras-50 import (line ~1155).
- Add a 51st entry to the `Promise.allSettled` array: `runExtraTalentSources().catch(() => ({ postings: [], bySource: {} }))`.
- Destructure `extras100Result` at the tail of the result tuple.
- Map its `postings` through the adapter → push survivors into `supplemental`.
- Add `extras100: extras100Postings.length` and `extras100_by_source: extras100Result?.bySource ?? {}` to the `signals` object (line ~1253) so per-source counts land in `techalert_hunter_runs.signals` and the HTTP response.

### 3. Fail-soft guarantees (already mostly inherent)
- `runExtraTalentSources` is internally `Promise.allSettled` per scanner — one source failing returns `[]`, never throws.
- Outer `.catch(() => ({ postings: [], bySource: {} }))` on the import call covers the (theoretical) module-load failure.
- Adapter wraps each mapping in a `try/catch` and skips the row on any error.
- No new env var required; no new secrets.

### 4. Verify
After deploy:
1. `supabase--curl_edge_functions` POST `/techalert-prospect-hunter` (manual run).
2. Confirm response JSON `signals.extras100` is a number and `signals.extras100_by_source` lists all 50 source keys (most `0`, since they're stubs — that's the expected fail-soft state).
3. Spot-check `techalert_hunter_runs` latest row → `signals` JSONB contains the same keys.
4. Note in CLAUDE.md "Current Session State" which extras-100 sources returned non-zero, so future work can prioritize promoting stubs to live scanners.

### Files to edit
- `supabase/functions/techalert-prospect-hunter/index.ts` — only file changed (~25 lines added).

### Out of scope
- Promoting any extras-100 stubs to real implementations (separate work; sources need API keys/scrapers).
- Storing raw `ExtraPosting` candidates in a new candidates table (would require migration; flag if the user wants this instead of the company-level adapter).
