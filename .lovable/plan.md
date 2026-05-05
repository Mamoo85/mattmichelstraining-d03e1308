## Audit of Claude's plan
All bugs claimed are confirmed in the current repo — nothing has been fixed yet:
- `contractor-prospector/index.ts:43` — `trialCtaHtml(opts)` is called with `{ product, ctaUrl }`, but `trialCtaHtml` expects `{ product, url }`. The href in every cold-email CTA renders as `undefined`.
- 5 `ctaUrl` values in `contractor-prospector` point to landing pages instead of `/start-trial`.
- 2 `ctaUrl` values in `techalert-outreach/index.ts` (lines 80, 106) point to `/talent-radar` instead of `/start-trial?product=techalert`.
- 3 AI prompts hardcode `https://www.detroitwebagent.com/hire-alert` and `/missed-call-catch` inside the email body text, so the LLM repeats the wrong URL even after we fix the button.

One correction to Claude's plan: routing `contractor_leads` and `dead_lead` through `/start-trial` is fine (the page auto-redirects them to their landing pages), but `wrapDwaShell` always injects a "Start your 7-day free trial" CTA box via `trialCtaHtml`. Neither product is actually trial-eligible. So we should use `plainCtaHtml` for those two, not `trialCtaHtml`.

## What I will change

### 1. `supabase/functions/contractor-prospector/index.ts`

**Fix the prop-name bug (line 43)**
- Change `trialCtaHtml(opts)` → `trialCtaHtml({ product: opts.product, url: opts.ctaUrl })` so the button gets a real href.

**Split trial vs non-trial CTA helpers**
- Extend `wrapDwaShell` to accept an `isTrial` flag (default true) and use `plainCtaHtml` when false, so non-trial products get an honest CTA instead of a fake "free trial" box.

**Fix the 5 cold-email CTA URLs**
- `buildEmailHtml` (Contractor Leads, line 351): non-trial — keep landing page `/contractor-leads`, switch to `plainCtaHtml`.
- `buildDeadLeadEmailHtml` (Dead Lead, line 400): non-trial — keep landing page `/dead-lead-intake`, switch to `plainCtaHtml`.
- `buildTechAlertEmailHtml` (line 505): trial — point to `/start-trial?product=techalert`.
- `buildMissedCallEmailHtml` (line 552): trial — point to `/start-trial?product=missed_call_catch`.
- `buildCareAlertEmailHtml` (line 606): trial — point to `/start-trial?product=techalert` (CareAlert is a TechAlert variant).

**Fix the URLs the AI is told to embed in the email body**
- TechAlert prompt (~line 481): `https://www.detroitwebagent.com/hire-alert` → `https://detroitwebagent.com/start-trial?product=techalert`
- Missed-Call prompt (~line 528): `https://www.detroitwebagent.com/missed-call-catch` → `https://detroitwebagent.com/start-trial?product=missed_call_catch`
- CareAlert prompt (~line 583): `https://www.detroitwebagent.com/hire-alert` → `https://detroitwebagent.com/start-trial?product=techalert`
- Dead Lead prompt: keep `/dead-lead-intake` (correct — it is a real intake page, not a trial).
- Contractor prompt: keep `/contractor-leads` (correct landing page).

### 2. `supabase/functions/techalert-outreach/index.ts`
- Line 80 (`teaserCardHtml.ctaUrl`) → `https://detroitwebagent.com/start-trial?product=techalert&utm_source=cold&utm_campaign=techalert`
- Line 106 (`dwaColdEmail.ctaUrl`) → same.

### 3. Deploy edge functions
After the edits, deploy:
- `contractor-prospector`
- `techalert-outreach`

### 4. Verify
Run the existing `e2e-link-auditor` from `/dwa-admin/link-health` to confirm every `/start-trial?product=...` URL we just introduced resolves cleanly (it already audits `techalert`, `missed_call_catch`, `contractor_leads`, `dead_lead`).

## Out of scope for this fix
- The bigger end-to-end "every email → every signup → every drip → revert" audit system you also asked about. This plan only addresses the immediate broken-link bug. Once approved I can do the larger lifecycle audit as a follow-up.