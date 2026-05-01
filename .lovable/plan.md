I found two concrete breakpoints behind the screenshots:

1. The One-Press run is completing with zero sends because internal calls to protected backend functions are failing with `UNAUTHORIZED_INVALID_JWT_FORMAT`. Recent run rows show failures like `contractor-outreach-email-blast 401` and zero scraped/enriched/sent counts.
2. The Agency Outreach cherry-pick drawer only looks at the last 7 days and only recognizes a narrow set of trade labels. Current live candidate data has almost no recent rows matching those exact labels, even though the TechAlert prospect hunter is producing company hiring targets and older candidate rows exist.

Plan to fix and harden this properly:

1. Rebuild One-Press execution around the send queue
   - Stop treating a completed run with zero sends as success.
   - Route One-Press sends through `outreach_send_queue` and `outreach-queue-worker` instead of direct provider sends where appropriate.
   - Report `queued`, `sent`, `skipped`, and `failed` separately so the card never lies.

2. Fix internal backend-to-backend auth
   - Update `outreach-one-press` and `contractor-outreach-auto-blast` internal function invocation headers to use the correct key format.
   - Keep public/admin entrypoints protected where needed, but allow trusted server-side orchestration to call scrape/enrich/blast reliably.
   - Deploy the affected backend functions after editing.

3. Add automatic One-Press self-healing
   - If scrape returns zero, automatically broaden city fallback: selected city → nearby Metro Detroit cities → statewide priority cities.
   - If eligible count is zero because quality threshold is too high, show the gate and optionally queue lower-confidence contacts as review-only instead of silently finishing.
   - If enrichment returns no emails, log which waterfall stages failed per prospect.

4. Upgrade the One-Press UI from a progress bar to a diagnosis panel
   - Add a latest-run summary with real blockers: auth failure, provider rate limit, no matching city/trade, no emails, daily cap, suppression, quality gate.
   - Add buttons for `Run worker now`, `Retry failed stage`, and `Open diagnostics`.
   - Add a visible warning when the run completed with zero sends.

5. Make Auto-Blast a true queued workflow
   - Replace direct send loops in `contractor-outreach-auto-blast` with queue insertion for consistency, retries, and observability.
   - Return `queued_count` immediately, then let the worker send with backoff.
   - Trigger the worker once after queueing so manual demos still feel instant.

6. Fix the Agency Outreach candidate matching logic
   - Expand candidate lookback from hard-coded 7 days to a tiered fallback: 7 days, then 30 days, then best available.
   - Match on more fields (`trade`, `license_type`, `current_title`, `qualifications_summary`, `current_employer`) and normalize values like `other_trade`, `hvac_tech`, `boiler_operator`, healthcare terms, machinist/CNC, skilled trades, etc.
   - Show the actual lookback window used in the UI so it does not misleadingly say “last 7 days” when fallback data is being used.

7. Add prospect fallback sources for “No matching candidates”
   - If no person-level candidates exist, use `techalert_prospect_targets` as a backup proof source: companies actively hiring HVAC/plumbing/electrical/boiler/industrial roles.
   - Label these separately as “Hiring demand proof” instead of pretending they are candidates.
   - Allow a draft/blast to use either candidate proof or hiring-demand proof.

8. Add a one-click “Refresh proof pool” control
   - Button triggers the relevant candidate/prospect refresh functions in sequence where available.
   - Then reloads Agency Outreach automatically.
   - Shows exact counts found by vertical, so failures are visible immediately.

9. Improve Agency Outreach blast behavior
   - If there are fewer than 50 candidate matches, send a smaller truthful teaser instead of failing.
   - If there are zero candidates but there are hiring-demand targets, generate a hiring-demand teaser instead.
   - If there is truly no proof, disable the blast and show the specific missing source/gate.

10. Add “never silently empty” safeguards
   - Add empty-state cards with next actions instead of generic “No matching candidates.”
   - Add run logging for candidate pool queries and agency blast fallbacks.
   - Add warnings when recent ingestion is stale or the candidate scanner has not produced matching candidates recently.

Files/functions I expect to change:
- `src/components/admin/OnePressLauncher.tsx`
- `src/components/admin/ContractorOutreachPanel.tsx`
- `src/components/dwa-admin/AdminAgencyOutreach.tsx`
- `supabase/functions/outreach-one-press/index.ts`
- `supabase/functions/contractor-outreach-auto-blast/index.ts`
- `supabase/functions/agency-prospect-list-blast/index.ts`
- Potentially one small migration for durable run/fallback diagnostics if the current JSON fields are not enough.

Validation after implementation:
- Test `outreach-one-press` directly and confirm it no longer produces a completed zero-send run with hidden 401s.
- Test Auto-Blast and confirm it queues/sends through `outreach_send_queue`.
- Query latest queue rows and one-press rows to confirm counts update correctly.
- Test Agency Outreach matching for industrial and healthcare agencies with fallback windows and no generic empty drawer.
- Verify the UI on the current mobile-sized viewport still shows actionable buttons without clipping.