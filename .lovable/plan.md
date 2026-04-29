# Wave 5 Finalization — Execution Checkpoint
*Last checkpoint: 2026-04-29*

## ✅ Completed this turn

### Migration applied (1 file)
- `admin_decision_audit`, `cron_health_events`, `edge_health_events`, `orphan_scan_results`, `lead_event_corroborations` tables — all with RLS + admin/coach SELECT policies + service_role bypass.
- `mortgage_radar_leads` columns added: `intent_score`, `intent_score_updated_at`, `extractor_run_id`, `verifier_grounded`, `verifier_citation_match`, `verification_method`. Plus indexes on `intent_score DESC` and `pipeline_stage`.
- Coach SELECT policies added to: `mortgage_radar_leads`, `enrichment_decision_audit`, `enrichment_dead_letter`, `enrichment_walker_config`, `health_check_pings`. (Skipped `enrichment_provider_spend_daily` — it's a view; coach inherits via underlying table grants.)
- SQL functions: `quarantine_suspect_leads()` (idempotent), `compute_lead_intent_score(lead_id)` (with decay).
- Audit triggers: `trg_audit_walker_config` (budget cap changes), `trg_audit_dlq_transition` (DLQ state changes).
- Seeded `intent_weights` config row.
- Cron schedules added: `quarantine-daily-report` (11:00 UTC daily), `edge-function-health-check` (every 15m), `intent-score-decay` (10:00 UTC daily).

### Shared module (1 of 4)
- `supabase/functions/_shared/strict-json.ts` — Claude Haiku tool-calling helper, model pinned to `claude-haiku-4-5-20251001`, temperature 0.1, `additionalProperties:false` enforced. Includes `assertAnthropicOnly()` guard.

## ⏭️ Remaining work (next turn)

**Shared modules (3 left):**
- `_shared/lead-extractor.ts`
- `_shared/lead-verifier.ts`
- `_shared/event-corroboration.ts`

**Edge functions (5 new + 4 modified):**
- New: `quarantine-daily-report`, `edge-function-health-check`, `env-validator`, `enrichment-e2e-export`, `orphan-scan`, `intent-score-decay`
- Modify: `mortgage-radar-scanner` (replace `sonarSearch` Gemini call with extractor→verifier pipeline), `mortgage-radar-am-digest` (sort by intent_score, Street View from lat/lon), `_shared/llm-contradiction-check.ts` (inline citations + Haiku), `_shared/ai.ts` (assertAnthropicOnly belt)

**Frontend (5 new + 5 modified):**
- New pages: `AuditTimeline.tsx`, `Quarantine.tsx`, `AdminEdgeHealth.tsx`
- New components: `LeadVerificationBadges.tsx`, `AlertRuleDiffView.tsx` (hand-rolled diff)
- Modify: `Wave5Dashboard.tsx` (realtime channel), `CronStatusWidget` (red-badge subscription), `AlertRuleTesterPanel.tsx` (mount diff view), `App.tsx` (3 routes + `<CoachReadOnlyRoute>`), `useIsAdmin.tsx` (add `useIsAdminOrCoach`)

**Tests (5):** quarantine seed test, lead-verifier substring test, env-config validator test, route-orphan test, coach-rbac e2e

## Notes
- Confirmed: zero direct `generativelanguage.googleapis.com` / `GOOGLE_GEMINI` / `GOOGLE_AI_API_KEY` call sites. All Gemini usage routes through `https://ai.gateway.lovable.dev`. Scope of LLM swap is **mortgage-radar-scanner only** for this wave (other scanners aren't exhibiting hallucination — out of scope).
- Linter warnings post-migration (235) are pre-existing project noise (search_path on legacy functions, public extensions, `USING (true)` on service_role bypass policies). None introduced by this migration — my new functions all have `SET search_path = public`, my new RLS policies all use `has_role()`.
- `coach` enum value already existed before this migration — no enum change needed.
