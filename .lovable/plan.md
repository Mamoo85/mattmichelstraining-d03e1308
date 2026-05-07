# Trial Conversion + Deployment Plan

Seven discrete items targeting the `/start-trial` drop-off and three pending edge function deploys.

## 1. Sticky mobile CTA bar
- New component `src/components/trial/StickyTrialCTA.tsx` — fixed bottom bar, `md:hidden`, safe-area inset padding, shadow, single primary button "Start 7-day free trial →".
- Mount on `/start-trial` and on every product landing page that links to trial (read current routes; gate via prop `productKey` so click scrolls to form OR routes to `/start-trial?product=<key>` with email pre-fill if captured).
- Hide when the trial form is in viewport (IntersectionObserver) so it doesn't double-stack with the form's own submit button.
- Fire `trackTrialEvent('sticky_cta_click', { product })`.

## 2. Product picker fallback on `/start-trial`
- When `?product=` is missing OR not in `PRODUCT_PITCH`, render a picker grid instead of erroring/blank.
- Pull from `PRODUCT_PITCH` keys in `StartTrial.tsx` (already canonical). Each card: icon, name, 1-line value prop, "Start free trial →".
- Selecting a card sets product in URL (`navigate('?product=...', { replace: true })`) — no reload, form mounts inline below.
- Track `picker_view` and `picker_select` events.

## 3. Trial funnel analytics
- Already partially shipped (`logTrialFunnelEvent` / `trackTrialEvent`). Audit `StartTrial.tsx` to confirm and add any missing events:
  - `view` (page mount, with product key)
  - `picker_view` / `picker_select` (new from item 2)
  - `form_focus` (first focus on any field)
  - `form_submit_attempt`
  - `form_submit_success` (before Stripe redirect)
  - `form_submit_error` (with error code/message)
  - `checkout_redirect` (immediately before `window.location.href = url`)
  - `sticky_cta_click` (from item 1)
- All writes go to `trial_funnel_events` (anon INSERT already granted Tuesday).
- Add a small admin tile to `AdminOpsCenter` showing 7-day funnel (view → focus → submit → success → redirect) with drop-off %.

## 4. Reduce form friction
- Make **business phone** optional (label "(optional)", remove `required`).
- Make **business name** optional with smart fallback: if blank, default to `"{first_name}'s {trade}"` server-side at trial creation. Update Zod/validation in both client and `start-trial` edge function.
- Keep required: email, first name, trade (these gate provisioning). Phone optional but show micro-copy: "Add phone for SMS lead alerts (recommended)".
- Re-test edge function happy path via `supabase--curl_edge_functions`.

## 5. Abandoned-trial drip
- New table `trial_abandonment_state` (email, product, last_event, last_event_at, resume_token uuid, emailed_at, completed_at).
- Trigger or scheduled function `trial-abandonment-sweeper` (cron every 30 min): finds rows where last event was `form_focus` or `form_submit_error` 30+ min ago, no `form_submit_success`, no `emailed_at`. Sends a one-click resume email with `https://detroitwebagent.com/start-trial?product=<key>&email=<email>&resume=<token>` (pre-fills email + product, marks resume in funnel events).
- Email via `dwaEmail()`. Subject: "You were one click away from {product} — finish in 30 sec".
- Honor `email_suppression` and `outreach-blocklist`.

## 6. Cold-email CTA URL pre-fill
- Audit all cold-email senders (TechAlert outreach, channel-prospector, dead-lead drip, mortgage-radar-outreach, marketplace, weekly digests). Update CTA URLs from `…/start-trial?product=X` → `…/start-trial?product=X&email={{recipient_email}}&src=cold_email&utm_campaign={{campaign}}`.
- `StartTrial.tsx` already needs to read `?email=` and pre-fill (add if missing).
- Centralize URL construction in `_shared/offer-url.ts` so future senders can't drift.

## 7. Deploy three edge functions
- `send-stewart-dental-proposal`
- `send-youngblood-proposal`
- `create-blueprint-checkout`
- Verify each exists in `supabase/functions/`, has CORS + correct `verify_jwt` in `config.toml`, then deploy.
- Smoke test `create-blueprint-checkout` with a test payload.

## Technical notes

**Files touched (estimate)**
- New: `src/components/trial/StickyTrialCTA.tsx`, `src/components/trial/ProductPicker.tsx`, `supabase/functions/trial-abandonment-sweeper/index.ts`, `supabase/functions/_shared/offer-url.ts` (if missing helper for cold email URLs).
- Edited: `src/pages/StartTrial.tsx` (picker fallback, email pre-fill, optional fields, more events), `src/lib/trialFunnel.ts` (new event types), `src/components/admin/AdminOpsCenter.tsx` (funnel tile), all cold-email senders (CTA URL helper), edge function `start-trial` (relaxed validation + business-name fallback).
- Migrations: `trial_abandonment_state` table (RLS, anon insert policy via service-role write only) + cron schedule for sweeper.

**Order of execution**
1. Migration (table + cron) — needs approval.
2. Edge function deploys (item 7) in parallel with frontend work.
3. Frontend: picker fallback + sticky bar + form friction + analytics events.
4. Sweeper edge function + abandonment writes from `StartTrial.tsx`.
5. Cold-email URL helper + sweep all senders.

**Out of scope** (not asked, will not touch)
- No new lead sources, no pricing changes, no new copy/positioning.
- No changes to Stripe products or webhook routing.

Confirm and I'll execute.