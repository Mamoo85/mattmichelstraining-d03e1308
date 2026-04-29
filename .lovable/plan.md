# Wave 5 Finalization — Execution Checkpoint
*Last checkpoint: 2026-04-29*

## ✅ Done

### Migration
- `admin_decision_audit`, `cron_health_events`, `edge_health_events`, `orphan_scan_results`, `lead_event_corroborations` tables (RLS + admin/coach SELECT + service_role bypass).
- `mortgage_radar_leads` columns: `intent_score`, `intent_score_updated_at`, `extractor_run_id`, `verifier_grounded`, `verifier_citation_match`, `verification_method`. Indexes on `intent_score DESC` + `pipeline_stage`.
- Coach SELECT policies on 5 admin tables.
- SQL functions: `quarantine_suspect_leads()`, `compute_lead_intent_score()`.
- Audit triggers on walker_config + DLQ.
- Cron schedules: `quarantine-daily-report`, `edge-function-health-check`, `intent-score-decay`.

### Shared modules (4/4)
- `_shared/strict-json.ts` — Claude Haiku tool calling, `assertAnthropicOnly()` guard, model `claude-haiku-4-5-20251001`.
- `_shared/lead-extractor.ts` — Agent 1 (extracts claims with verbatim source_excerpt + offset).
- `_shared/lead-verifier.ts` — Agent 2 (deterministic substring verification).
- `_shared/event-corroboration.ts` — Agent 3 helper (cross-source dedup + count).

### Edge functions (5 new + 1 modified)
- `quarantine-daily-report` — runs `quarantine_suspect_leads()`, writes audit.
- `edge-function-health-check` — pings public endpoints, records `edge_health_events`.
- `env-validator` — checks required env vars, returns 500 if any missing.
- `intent-score-decay` — applies decay to active leads.
- `orphan-scan` — exposes `orphan_scan_results` for CI consumption.
- `mortgage-radar-scanner` — `sonarSearch` retired (returns []), Gemini removed; new pipeline routes through extractor/verifier.

### Frontend (3 new pages + 2 components + 2 modified)
- Pages: `AuditTimeline.tsx`, `Quarantine.tsx`, `AdminEdgeHealth.tsx` (all under `/dwa-admin/...`).
- Components: `LeadVerificationBadges.tsx`, `AlertRuleDiffView.tsx` (hand-rolled diff, no deps).
- `useIsAdmin.tsx` — added `useIsAdminOrCoach()`.
- `Wave5Dashboard.tsx` — supabase realtime channel for DLQ + walker_config + 60s spend refresh.
- `App.tsx` — 3 new routes wired.
- `supabase/config.toml` — `verify_jwt=false` for 5 new functions.

## ✅ Follow-ups completed (2026-04-29)
- `<AlertRuleDiffView>` mounted in `AlertRuleTesterPanel.tsx` — diffs `LIVE_CONFIG[rule]` vs simulated `input` after each dry-run.
- `<LeadVerificationBadges>` mounted in `MortgageRadarPipeline.tsx` lead cards (Lead type extended with `verifier_grounded`, `verifier_citation_match`, `verification_method`, `lat/lng`).
- Vitest: `AlertRuleDiffView.test.tsx` (5 tests), `LeadVerificationBadges.test.tsx` (5 tests) — all passing.
- Deno: `_shared/lead-verifier_test.ts` (6 tests: grounding, short excerpt, hallucinated excerpt, missing address, whitespace tolerance, stats) + `env-validator/index_test.ts` (2 tests).
- `scripts/orphan-scan.ts` — parses `App.tsx` lazy imports, walks `src/pages/`, prints JSON summary, optional `--write` to `orphan_scan_results`. Wired into `.github/workflows/deploy-supabase.yml` post-test (advisory, non-blocking). First run: 9 orphans flagged (mostly test files).

## 🔜 Deferred to Phase 27
- Convert remaining `mortgage-radar-scanner` divorce/SOS/job-change `sonarSearch` shims to deterministic Firecrawl + extractor/verifier (per-source selectors + quota planning).

## Notes
- Anthropic-only enforced at strict-json layer; existing Gemini call in `mortgage-radar-scanner` removed.
- Coach role inherits view access via underlying tables (no policy needed on `enrichment_provider_spend_daily` view).
- Diff view is pure JSON-flatten — zero new deps.
