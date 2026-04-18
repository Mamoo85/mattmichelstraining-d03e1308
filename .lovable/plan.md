

User wants a 3-phase sprint executed in strict order. This is a clear implementation task — no clarifying questions needed, the diagnosis from prior turns gave us exact root causes. Let me plan tightly.

## Phase 1: Pipeline Infrastructure (must finish + deploy before Phase 2)

### 1.1 Fix `hire_alert_runs` schema
Investigation needed: read `supabase/functions/hire-alert-scanner/index.ts` to see EXACT insert payload, then read latest migration on `hire_alert_runs` to see actual columns. From session memory: scanner uses `started_at` (not `run_at`). Likely also missing: `completed_at`, `tos_blocked`, `processed`, `errors[]`, `source_breakdown jsonb`.

Migration: `ALTER TABLE hire_alert_runs ADD COLUMN IF NOT EXISTS ...` for every field the scanner writes. Don't drop existing columns — additive only.

### 1.2 Candidate scorer for `hire_alert_candidates`
Create new edge function `candidate-quality-scorer` (don't pollute lead-quality-scorer which works on a different table).

Scoring rubric (1-10):
- +2 phone present, +1 phone E.164 valid
- +2 email present (non-generic prefix per existing email rules)
- +2 LinkedIn or Facebook URL present
- +1 current_employer present
- +1 license_type populated
- +1 city in Metro Detroit counties (Wayne/Oakland/Macomb)
- +1 years_experience >= 3
- Cap 10, floor 1

Writes `quality_score` + `scored_at`. Schedule daily 11:30 UTC. Manual trigger param `{candidate_ids?: []}`.

### 1.3 Fix `trade` column NULL
Read `hire-alert-scanner/index.ts` to see why `trade` isn't being written. Likely the source-specific scanners (BPL, Apollo, ArcGIS) extract `license_type` but never normalize to `trade`. Add `classifyTrade(license_type, source, raw_text)` helper in scanner — maps "Boiler Operator" → "boiler", "Electrical" → "electrical", etc. Write at insert time.

Also have scorer do fallback classification for legacy NULL rows.

### 1.4 Wire PDL/Apollo enrichment into the candidate pipeline
`batch-enrich-candidates` already exists for Sonar OSINT. Need:
- Schedule it more aggressively (currently manual/small batch)
- Add PDL fallback when Sonar returns no phone/email (PDL_API_KEY exists in secrets)
- Target the contactless 94% specifically: filter `WHERE email IS NULL AND phone IS NULL`
- Schedule new cron: `candidate-enrichment-hourly` running `batch-enrich-candidates` every 2h, batch size 10

## Phase 2: Backfill + retest

- One-shot SQL/edge-function call to score all 160 existing candidates via new scorer
- One-shot trade classification for legacy NULL `trade` rows (SQL migration with CASE statement on `license_type`)
- Re-run `cron-sentinel` + verify `hire_alert_runs` now logs
- Verify in DB: `SELECT count(*) FILTER (WHERE quality_score >= 7), count(*) FILTER (WHERE trade IS NOT NULL), count(*) FILTER (WHERE email IS NOT NULL OR phone IS NOT NULL) FROM hire_alert_candidates;`
- Report deltas in chat

## Phase 3: Demand Radar checkouts

Investigation: check if `create-industry-pulse-checkout` already exists (it does per CLAUDE.md). Confirm 3 SKU price points are wired:
- $99 one-time snapshot
- $199/mo weekly digest
- $499/mo enterprise

Likely currently only handles one tier. Update to accept `tier: "snapshot" | "weekly" | "enterprise"` with corresponding `price_data`.

Add FCRA/B2B disclaimer block to `IndustryPulse.tsx` checkout page (mem://business/techalert-compliance-disclosures already documents the canonical language — reuse). Required line: "B2B market intelligence — not a consumer report. Not for FCRA-regulated decisions (employment, credit, housing, insurance)."

### Deliverables

- Migration: `hire_alert_runs` schema alignment + `hire_alert_candidates` trade backfill
- New edge function: `candidate-quality-scorer` + cron schedule
- Updated edge function: `hire-alert-scanner` (trade classifier inline)
- Updated edge function: `batch-enrich-candidates` (PDL fallback + larger scope) + new 2h cron
- Updated edge function: `create-industry-pulse-checkout` (3 tiers)
- Updated page: `IndustryPulse.tsx` (3 SKU buttons + FCRA disclaimer)
- Backfill script run after deploy: score 160 + classify trades + enrich top 50 contactless
- Verification report in chat: before/after numbers
- Memory update: `mem://features/candidate-pipeline-v2` documenting the scorer + enrichment cadence

### Out of Scope

- No new candidate sources (work with existing 16+)
- No TechAlert pricing changes
- No new sample PDFs this round (separate request)
- No UI redesign of MyTechAlert

### Order of execution (strict)

1. Read scanner + migrations to finalize exact schema diff
2. Migration first (additive columns)
3. Deploy scanner with trade classifier
4. Deploy new candidate-quality-scorer
5. Deploy enriched batch-enrich-candidates + new cron
6. Run backfill (score + classify + enrich top 50)
7. Verify counts, post delta report
8. Deploy 3-tier industry-pulse checkout + FCRA disclaimers
9. Test each Demand Radar checkout end-to-end with $0 admin sandbox flow
10. Final go/no-go report per SKU

