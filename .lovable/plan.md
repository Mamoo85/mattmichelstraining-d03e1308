## Update CLAUDE.md to Reflect Current Repository State

Update the single file `CLAUDE.md` to capture work landed since Phase 43 (commits through `8b0dfd9`).

### 1. Add Phase 44 entry (above Phase 43)

New `### Phase 44 — Enrichment Hardening + HubSpot Bridge + Trial SLA Guarantee COMPLETE ✅` block covering:
- **Snov.io fallback** (`8b0dfd9`): Hunter.io API header bug fixed; Snov.io added as enrichment fallback in `outreach-leads-enrich`. Waterfall is now Apollo → Hunter → Firecrawl → Snov.
- **HubSpot CRM bridge** (`a703ff6`): Identified SiteRadar visitors + voicemail leads pushed to HubSpot contacts via `_shared/crm-webhook.ts`.
- **Demand/Buyer/Dead-Lead enrollment** (`1970c18`): Matt enrolled in Demand Radar, Buyer Radar, Dead Lead Reactivation. Missing crons added: `demand-radar-enhanced-scan` (12:00 UTC), `field-service-daily-summary` (13:00 UTC).
- **Trial Delivery Guarantee E1–E10** (`75e0df5`–`e163745`): `trial_signups` SLA columns (`first_lead_delivered_at`, `sla_status`, `compensation_applied`), `trial-drip-runner` function, auto-compensation on underdelivery.

### 2. Update Codebase Scale counts

| Field | Old | New |
|---|---|---|
| Frontend pages | 328 | 382 |
| Edge Functions | 859 | 918 |
| Migration files | 707 | 791 |
| AI agents | 33 | 33 |

### 3. Document new `_shared/` utilities

Add to the shared utilities bullet list in **Edge Function Conventions**: `address-validation.ts`, `alert-rules.ts`, `budget-gate.ts`, `cheap-extract.ts`, `compliance-waterfall.ts`, `crm-webhook.ts`, `demand-radar-log.ts`, `dlq.ts`, `domain-resolver.ts`, `dwa-email.ts`, `email-suppression.ts`, `engine-log.ts`, `enrichment-breaker.ts`, `enrichment-budget.ts`, `enrichment-pipeline.ts`, `error-log.ts`, `firecrawl-scrape.ts`, `founder-seats.ts`, `intake-throttle.ts`, `kpi-math.ts`, `lead-verifier.ts`, `license-waterfall.ts`, `llm-cache.ts`, `market-waterfall.ts`, `marketing-kill-switch.ts`, `offer-ad-prompt.ts`/`offer-url.ts`/`offers.ts`, `provenance.ts`, `request-id.ts`, `signal-waterfall.ts`, `source-probes.ts` + `sources/`, `tech-session.ts`, `telemetry.ts`, `trade-canonical.ts`.

### 4. Add Snov.io secret

Add `SNOV_IO_API_KEY` (or `SNOV_CLIENT_ID`/`SNOV_CLIENT_SECRET` — confirmed by reading `outreach-leads-enrich/index.ts`) to the Enrichment row of the Secrets table.

### Verification

After edits, run:
- `grep "Phase 44" CLAUDE.md`
- `grep -E "382|918|791" CLAUDE.md`
- `grep "crm-webhook" CLAUDE.md`
- `git diff --stat` (only `CLAUDE.md` should change)

### Files touched

- `CLAUDE.md` (only)

Reads before editing (to confirm exact symbol names): `supabase/functions/outreach-leads-enrich/index.ts`, `supabase/functions/_shared/crm-webhook.ts`.
