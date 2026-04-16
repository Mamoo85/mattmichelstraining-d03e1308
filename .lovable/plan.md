
Audit is comprehensive and accurate. Plan to execute all 6 critical + 2 moderate fixes in one pass.

## Migration (one file)
- Create `outreach_cooldowns` + `campaign_copy_variants` tables (RLS + service_role policy)
- Add 2 RLS policies to `contractor_lead_views` (service_role full + admin read via `has_role`)
- Add `status TEXT DEFAULT 'ok'` to `agent_heartbeats`
- Delete 10 stale heartbeat rows (Oz, Scarlett, Selma, Ops, Mute, Pulse, Scout, Hype, Drill, Ref) — cleaner than fake-ok'ing them; they'll re-insert when their crons actually run
- Re-create `hire-alert-scanner-daily` cron using `vault.decrypted_secrets` pattern (the known-broken `current_setting('app.supabase_url')` returns NULL in pg_cron)

## Code
- `src/App.tsx`: add `<Route path="/web-design" element={<Navigate to="/web-design-services" replace />} />`
- Redeploy `generate-postcard-copy` (force pickup of `audience_type` insert) — touch the file's header comment to trigger redeploy

## Skipping
- **Issue #7 (0 contractor purchases)**: Not a bug — no contractors have signed up yet. Real fix is sales (Tom outreach), not code. Will note in plan but no action.
- **Issue #9 (low dead lead campaigns)**: Same — needs customers, not code.

## Verification after deploy
- Manually invoke `hire-alert-scanner` once to seed `hire_alert_runs` row
- Manually invoke `generate-postcard-copy` with `audience_type: "trades"` and confirm it persists

## M2 Training branding (your last question)
Phase 15 already shipped DWA branding/security hardening. M2 Training side hasn't had reported regressions this session. I'll spot-check `mattmichelstraining.com` routes (AthleteBlueprint, ForParents, Results, Programs) for orange-theme integrity during the verification pass and flag anything broken — no preemptive code changes.

## Files touched
- `supabase/migrations/[timestamp]_launch_readiness_fixes.sql` (new)
- `src/App.tsx` (1-line route add + Navigate import if missing)
- `supabase/functions/generate-postcard-copy/index.ts` (header bump for redeploy)

Approve and I'll execute.
