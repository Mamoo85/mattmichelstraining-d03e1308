## Audit-first stays the same — most of this wave already shipped

`Wave5Dashboard`, `alert-rule-tester`, `cron-health-monitor`, `enrichment-e2e-verify`, `RerunEnrichmentDialog`, `AlertLogSearchPanel`, `AdminErrorLogs`, `app_role`+`has_role`+`AgencyAdminRoute`, Firecrawl scrapers, mortgage quarantine column — all present. This plan only fills real gaps.

---

## Corrections applied from review

1. **Haiku ID**: use `claude-haiku-4-5-20251001` everywhere (matches `_shared/opus.ts:14` and `_shared/ai.ts:22`). Never the unsuffixed alias.
2. **Anthropic-only enforcement is grep-and-rip, not just a runtime guard**. Verified: zero direct `generativelanguage.googleapis.com` / `GOOGLE_GEMINI` / `GOOGLE_AI_API_KEY` call sites. All Gemini usage routes through `https://ai.gateway.lovable.dev/v1/chat/completions` with `model: "google/..."`. Plan: grep every scanner/enrichment edge function for `ai.gateway.lovable.dev` + `model:.*google/`, replace with direct Anthropic call (`https://api.anthropic.com/v1/messages` + `claude-haiku-4-5-20251001`) following the `_shared/ai.ts` pattern. Then add the runtime guard as belt-and-suspenders inside `_shared/ai.ts` (`generateText` rejects `model.startsWith("google/")` when caller hint matches scanner paths).
3. **config.toml validator inverted**: assert *every `[functions.X]` block in config.toml has a matching directory on disk* (catches typos and orphan public-endpoint entries). Do **not** require every directory to have an entry — internal worker functions correctly default to `verify_jwt = true` and aren't called from browser. Separately, lint a small allowlist of *known public endpoints* (webhooks, checkouts, claim-session, visitor-identify, missed-call-handler) and assert each one **does** have an entry with `verify_jwt = false`.
4. **No pinging `mortgage-radar-scanner` in health checks**. It triggers a real scan. Either add a `{ action: "ping" }` early-return branch (200, no side effects), or — preferred — monitor `cron_health_events` row freshness for that surface name. Going with cron-row-freshness; cheaper and matches existing `cron-sentinel` pattern.
5. **Coach RBAC needs RLS, not just a UI gate**. Plan now: migration adds `'coach'` to `app_role` enum, then updates SELECT policies on every table the coach dashboard reads — `enrichment_provider_spend_daily`, `enrichment_dead_letter`, `enrichment_walker_alerts`, `enrichment_walker_config` (SELECT only), `enrichment_decision_audit`, `mortgage_radar_leads`, `cron_health_events`, `admin_decision_audit`, `health_check_pings`, `edge_health_events` — using `WHERE has_role(auth.uid(),'admin') OR has_role(auth.uid(),'coach')`. Coach role gets zero INSERT/UPDATE/DELETE. UI route wrapper is a second layer, not the only layer.
6. **`enrichment-e2e-export` returns proper download headers**: `Content-Type: text/markdown; charset=utf-8`, `Content-Disposition: attachment; filename="smoke-run-YYYY-MM-DD.md"`. Frontend uses `window.open()` or `<a download>` with the function URL — no fetch+blob dance needed.
7. **Diff util hand-rolled, no new dep**. ~30 LOC inside `AlertRuleDiffView.tsx`: walks two JSON objects, returns `{added: string[], removed: string[], changed: {key, before, after}[]}`. No `deep-diff` / `just-diff` package.
8. **Orphan scanner uses route-graph parsing, not madge**. Script parses `src/App.tsx` for `<Route path="..." element={<X .../>}` plus all `lazyRetry(() => import("./pages/Y"))` calls, builds a set of referenced page modules, diffs against `ls src/pages/**/*.tsx`. Anything in pages but not in the route set is flagged. Components: scan all `.tsx` under `src/components/`, grep for any `import` of each component name across `src/`. Result written to `orphan_scan_results` table; surfaced in `AdminHealth`.

---

## Architectural upgrades to anti-hallucination (from second review)

Item 7 isn't just "swap the model." Hallucination is structural. Adding:

**A. Two-pass extractor → verifier pipeline (replaces single-call extraction)**
- **Agent 1 — Extractor** (`_shared/lead-extractor.ts`): given scraped HTML/markdown from Firecrawl, returns strict JSON: `{address, event_type, source_url, source_excerpt, source_excerpt_offset}`. Temperature 0.1. Tool-call constrained schema, `additionalProperties: false`, `required` on every field.
- **Agent 2 — Verifier** (`_shared/lead-verifier.ts`): given the extractor's JSON + the *same* source HTML, returns `{grounded: boolean, citation_match: boolean, address_present_in_source: boolean, reason: string}`. Temperature 0.0. If `grounded=false` OR `citation_match=false`, lead is rejected before insert.
- **Agent 3 — Approver** (lightweight, deterministic in code, not an LLM call): combines verifier output + Google Address Validation result + cross-source corroboration count. Sets `pipeline_stage='approved' | 'quarantined_pre_validation'`.

**B. Constrained decoding everywhere**
- New `_shared/strict-json.ts` helper that wraps Anthropic tool-calling with required `tool_choice`, `max_tokens` 800, `temperature` 0.1. All scanner LLM calls migrate to this.
- Free-form text extraction is banned in scanner code paths via `assertStructuredOnly()` guard.

**C. Inline citation requirement in `llm-contradiction-check.ts`**
- Schema requires `claims: [{claim_text, source_quote, source_offset_start, source_offset_end}]`.
- Server-side verifier asserts each `source_quote` is a substring of the original Firecrawl markdown. Mismatches → discard the claim, log to `enrichment_decision_audit` with `decision_kind='ungrounded_claim_dropped'`.

**D. Event verification, not just address existence**
- New `_shared/event-corroboration.ts` with pluggable adapters. Phase 1 free sources only:
  - **FSBO event**: requires Zillow FSBO listing URL that resolves 200 + Address Validation pass.
  - **Probate event**: requires Wayne County probate docket reference (existing `scrapers-county-records.ts` already pulls these — wire into corroboration).
  - **Divorce event**: requires court records hit.
- A lead with `event_type` set but zero corroborating sources is auto-quarantined with reason `unverified_event`. Premium adapters (Tracers / LexisNexis) stubbed behind feature flag for later when keys exist.

**E. Conversion Probability Score + decay**
- New columns on `mortgage_radar_leads`: `intent_score numeric(4,2)`, `intent_score_updated_at timestamptz`, `signal_count int`, `last_signal_at timestamptz`.
- New function `compute_lead_intent_score(lead_id)`: weighted sum of (event_type_weight × signal_strength) − `decay_factor × days_since_last_signal`. Weights configurable in `enrichment_walker_config` (`intent_weights` JSON key).
- Daily cron `intent-score-decay` recomputes all active leads; leads dropping below threshold get `pipeline_stage='archived_low_intent'`.
- AM digest sorted by `intent_score DESC`.

---

## Concrete deliverables

### Migration (1 file)
- `app_role` enum: add `'coach'`
- New tables: `admin_decision_audit`, `cron_health_events` (if missing), `edge_health_events`, `orphan_scan_results`, `lead_event_corroborations`
- New columns on `mortgage_radar_leads`: `intent_score`, `intent_score_updated_at`, `signal_count`, `last_signal_at`, `extractor_run_id`, `verifier_grounded`, `verifier_citation_match`
- SQL functions: `quarantine_suspect_leads()`, `compute_lead_intent_score(lead_id)`
- Triggers: budget cap change, quiet-hours override, DLQ status transition → `admin_decision_audit`
- RLS coach-read policies on the 10 listed tables
- pg_cron: `intent-score-decay` daily 6am ET, `quarantine-daily-report` daily 7am ET, `edge-function-health-check` every 15m, `orphan-scan` weekly Mon 3am ET

### Edge functions
**New (5):**
- `quarantine-daily-report` (cron)
- `edge-function-health-check` (cron, uses allowlist of safe-to-ping endpoints; never pings scanner)
- `env-validator` (manual + CI; inverted logic per correction #3)
- `enrichment-e2e-export` (HTTP, attachment headers per correction #6)
- `orphan-scan` (route-graph parsing per correction #8)

**Modified (4):**
- `mortgage-radar-scanner`: replace single Gemini call with extractor→verifier→approver pipeline; swap model to `claude-haiku-4-5-20251001` direct via `https://api.anthropic.com/v1/messages`
- `mortgage-radar-am-digest`: build Street View URLs from stored `lat,lng` columns; sort by `intent_score DESC`
- `_shared/llm-contradiction-check.ts`: inline citation schema + substring verification + Haiku model
- `_shared/ai.ts`: add `assertAnthropicOnly(model, callerHint)` runtime guard

**New shared modules (4):**
- `_shared/lead-extractor.ts`
- `_shared/lead-verifier.ts`
- `_shared/strict-json.ts`
- `_shared/event-corroboration.ts`

### Frontend
**New pages (3):** `AuditTimeline.tsx`, `Quarantine.tsx`, `AdminEdgeHealth.tsx`
**New components (2):** `LeadVerificationBadges.tsx`, `AlertRuleDiffView.tsx` (hand-rolled diff)
**Modified:** `Wave5Dashboard.tsx` (realtime channel + intent histogram), `CronStatusWidget` (red badge subscribed to `cron_health_events`), `AlertRuleTesterPanel.tsx` (mount diff view), `App.tsx` (3 routes + `<CoachReadOnlyRoute>`), `useIsAdmin.tsx` (add `useIsAdminOrCoach`)

### Tests
- `mortgage-radar-scanner/quarantine.test.ts` — seeds fabricated addresses, asserts extractor→verifier→approver rejects them
- `_shared/lead-verifier.test.ts` — citation substring matcher unit tests
- `src/lib/__tests__/env-config.test.ts` — inverted config.toml validator
- `src/lib/__tests__/route-orphan.test.ts` — route-graph parser
- `tests/e2e/coach-rbac.spec.ts` — coach JWT can read Wave 5, cannot mutate

### Out of scope (acknowledged, not building)
- Tracers / LexisNexis paid adapters → stubs only
- Full Playwright re-run across all pages → existing suites cover it
- Click-test checklist as runnable suite → markdown doc only
- Session-pixel correlation analytics → defer

---

## Execution order

1. Migration (RLS, tables, functions, crons)
2. Grep + rip Gemini calls in scanner/enrichment paths → Anthropic Haiku direct
3. Build 4 new shared modules (extractor, verifier, strict-json, event-corroboration)
4. Rewrite `mortgage-radar-scanner` pipeline; update `am-digest`
5. Build 5 new edge functions
6. Build 5 new frontend files + wire routes + realtime + diff view
7. Run vitest + Deno tests; deploy edge functions; verify with curl
8. Single delivery message with what shipped, what was found dead, test counts

Approve and I'll execute end-to-end.