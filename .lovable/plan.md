# 48-Hour Audit + Click Test

## What I found (data, not opinion)

The last 48h shipped **210 changed files**: 56 new edge functions, 34 migrations, 39 new components, 5 new pages, 3 new e2e suites. Brand-new pages (`AdminHealth`, `OutreachAuditLog`, `OutreachObservability`, `OutreachQueue`, `Wave5Dashboard`) are all routed in `App.tsx`. Almost everything is wired correctly. But a sweep turned up real gaps:

### Orphaned components (built, never imported anywhere)
1. `src/components/dwa-admin/CandidateLicenseEditor.tsx`
2. `src/components/dwa-admin/HealthcareSourceHealthPanel.tsx`

### Orphaned edge functions (never called from frontend, no cron, no other function)
Most have `[functions.X]` in `config.toml` but no caller — they're deployed dead weight or were meant to be cron'd:
- `compute-intent-score`, `intent-score-recompute`
- `geocode-signals-batch`
- `hiring-velocity-tracker`
- `cron-health-monitor` (should run on schedule by name)
- `rfp-keyword-bounty`
- `dossier-cold-outreach-bulk`, `dossier-share-page`
- `generate-account-narrative` (note: `AccountNarrativeDrawer` IS imported, may call this — needs verify)
- `signal-triggered-sms-draft`, `signal-outreach-cancel-bulk`
- `outreach-reply-handler`, `resend-bounce-webhook` (these are inbound webhooks — Twilio/Resend point at them externally; "no caller" is expected, but they need webhook URLs documented)
- `contractor-outreach-unsubscribe` (List-Unsubscribe header target — also expected)
- `healthcare-sources-rerun`, `nursys-enroll`

### Missing `supabase/config.toml` entries (will deploy with `verify_jwt = true` and break)
1. `contractor-outreach-sms-send` — Twilio inbound? must be public
2. `healthcare-sources-rerun`
3. `mortgage-radar-founder-invite` — public invite link, must be public
4. `nursys-enroll`

### Code-quality flag
- `supabase/functions/outreach-one-press/index.ts` uses `// @ts-nocheck` or `@ts-ignore` — needs review.

---

## Plan (in execution order)

**Step 1 — Verify each "orphan" against actual callers before deleting**
Re-grep across full codebase for each orphan (some are webhook targets or called by name dynamically). Categorize as:
- **WIRE**: real orphan that should be wired (e.g. `CandidateLicenseEditor` likely belongs on a candidate detail page).
- **WEBHOOK**: external-callable, leave but document in `CLAUDE.md`.
- **CRON-MISS**: function whose name implies a schedule (e.g. `cron-health-monitor`, `intent-score-recompute`, `intent-spike-notifier`) but has no `pg_cron` job. Add cron migration.
- **DELETE**: truly dead.

**Step 2 — Fix the 4 missing `config.toml` entries**
Add `[functions.X]` blocks with `verify_jwt = false` for the public/webhook ones (`contractor-outreach-sms-send`, `mortgage-radar-founder-invite`); leave `verify_jwt = true` for admin-only (`healthcare-sources-rerun`, `nursys-enroll`).

**Step 3 — Wire the 2 truly orphaned components**
- `CandidateLicenseEditor` → mount inside the existing TechAlert candidate detail/edit panel.
- `HealthcareSourceHealthPanel` → mount on `Wave5Dashboard` or `AdminClientHealth` (whichever already shows source health).

**Step 4 — Backfill cron jobs for orphan workers** (only those whose name implies a schedule)
Single migration adding `pg_cron` schedules for: `cron-health-monitor` (every 5 min), `intent-score-recompute` (hourly), `geocode-signals-batch` (every 15 min), `hiring-velocity-tracker` (daily 7am ET), `outreach-backlog-watchdog` if missing.

**Step 5 — Clean up `outreach-one-press` `@ts-nocheck`**
Read the file, type the offending lines, remove the suppression.

**Step 6 — Run the existing automated suites**
- `bunx vitest run` — full unit suite (231 tests as of last session).
- `npx playwright test tests/e2e/auth-smoke.spec.ts tests/e2e/dashboard-smoke.spec.ts tests/e2e/checkout-smoke.spec.ts tests/e2e/receipt-banner.spec.ts` — the new smoke suites.
- `bunx supabase test edge-functions` for the new function tests (`safe-parse.test.ts`, `signup-classifier.test.ts`, `contractor-outreach-enrich-backfill/index.test.ts`, etc.).

**Step 7 — Live click-test the 5 brand-new pages with the browser tool**
Navigate to each, observe, screenshot, capture console errors:
1. `/admin-health` — run health check, confirm it returns auth_ok / db_read_ok / db_write_ok.
2. `/admin/outreach-observability`
3. `/admin/outreach-queue`
4. `/admin/outreach-audit-log`
5. `/admin/wave5-dashboard`
Plus a smoke pass on `/mortgage-radar` (fresh anti-hallucination work) and `/contractor-marketplace` (new guest flow).

**Step 8 — DB sanity sweep**
Quick `read_query`:
- Count rows in `mortgage_radar_leads` where `pipeline_stage = 'quarantined_pre_validation'` vs active (confirm last sweep stuck).
- Confirm no new leads since the manual scanner run lack `lat`/`lon`.
- Spot-check `outreach_queue`, `outreach_audit_log`, `enrichment_walker_alerts` tables exist and have RLS.

**Step 9 — Report**
Single message back with: (a) what was orphaned + how it was fixed, (b) test pass/fail counts, (c) screenshots of the 5 new admin pages, (d) any runtime errors found, (e) anything I think still needs Matt's eye.

---

## Out of scope (call out, don't fix)
- I won't refactor the 56 new edge functions for style.
- I won't add new features.
- I won't touch the anti-hallucination code we just shipped — only verify it via the DB sweep in Step 8.

---

## Risk
Low. Steps 1–5 are additive (new config, new mounts, one cron migration). Steps 6–8 are read-only verification. The only DB change is a small cron migration (Step 4), which uses `IF NOT EXISTS` patterns and is reversible.

Approve and I'll execute end-to-end and report back in one message.
