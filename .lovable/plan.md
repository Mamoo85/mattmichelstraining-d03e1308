## What I found

- **OpenRouter is not hard-capped at $5/day right now.** The shared helper intentionally allows **$25/day until 2026-05-20**, then $5/day. Today’s logged OpenRouter spend is already about **$23.47 across 1,902 calls**, with **0 blocked calls**.
- **Many OpenRouter call sites bypass the shared budget helper entirely.** I found direct `fetch("https://openrouter.ai/api/v1/chat/completions")` calls across scanner/enrichment functions, so the current ledger cannot enforce a true global cap.
- **AmeriSteel hub tracking is not implemented yet.** There is a `trial_bundles` hub and a generic `trial_funnel_events` table, but no hub click table, no CTA-step completion state, and the one-link email does not include UTM params.
- **Digest status today:**
  - Mortgage Radar cron ran today, but `mortgage-radar-am-digest` recorded **digests_sent: 0** even though there are **3 active Mortgage Radar clients** and **128 leads in the last 24h**. This needs a query/recipient/debug fix, not just another cron.
  - SiteRadar weekly digest cron is **missing from the live cron list**; only `siteradar-cold-blast-daily` exists. Also there are **0 paid active SiteRadar clients** by the current weekly-digest filter, so the trial/provisioned accounts would be skipped.
  - TechAlert weekly digest is scheduled **Mondays only**, not daily. The last Monday run failed with `job startup timeout`; there is no retry job for it.
- **X/screenshots:** the UI appears to be an **agent observability/control-room dashboard**: a game-like map of autonomous agents/workstations, each showing live task state, product/listing work, revenue/orders/conversion metrics, and queue progress. It is likely not “watching AI think” directly; it is visualizing logs/events from multiple agents and commerce channels in real time.

## Plan

### 1. Make OpenRouter $5/day a real hard cap immediately

- Update the shared OpenRouter helper to default to **$5/day now**, removing the temporary `$25/day` grace window.
- Add a **pre-call reservation gate** instead of only recording cost after the response:
  - reserve a conservative estimated cost before making the request;
  - block if the reservation would exceed `$5`;
  - record blocked attempts in `openrouter_daily_spend.blocked_count`.
- Add/update database RPCs so the cap is enforced atomically in the database, not with race-prone read-then-call logic.
- Refactor high-volume direct OpenRouter call sites to use the shared helper or a new shared guarded fetch wrapper.
- For low-value/high-frequency jobs, disable OpenRouter fallback first and prefer free/Lovable Gateway/free-source paths.
- Add admin visibility to today’s spend/calls/blocked count if an existing admin budget page exists; otherwise keep it queryable in the ledger.

### 2. Add UTM tracking and click logging for AmeriSteel teaser/hub emails

- Add a dedicated `trial_hub_events` table with fields for:
  - `bundle_token`, `email`, `product_key`, `event_type`, `cta_step`, `utm`, `metadata`, `user_agent`, `referrer`, `created_at`.
- Create a lightweight `trial-hub-track` backend function:
  - `POST` records `hub_view`, `email_click`, `tile_open`, and `cta_step_completed` events;
  - validates token/product/event names;
  - returns a safe JSON response.
- Update the single AmeriSteel hub email link to include UTM params, for example:
  - `utm_source=email`
  - `utm_medium=trial_hub`
  - `utm_campaign=ameristeel_trials`
  - `utm_content=single_hub_link`
- Update teaser email links so each product CTA includes distinct `utm_content` and product identifiers.
- If possible, replace direct product links with tracked hub links first, then let the hub record the click before navigation.

### 3. Record CTA-step completion and show progress in the AmeriSteel hub

- Extend `hub-summary` to return progress per product:
  - email clicked;
  - hub viewed;
  - product dashboard opened;
  - setup step completed / needs setup;
  - last activity time.
- Update `TrialHub.tsx` to:
  - log hub views on load;
  - log tile opens before navigation;
  - show each product tile’s progress state (`Not opened`, `Opened`, `Setup needed`, `Active`, etc.);
  - display an overall progress bar/count for all 5 trials.
- For AmeriSteel-specific “setup needed” states:
  - SiteRadar: needs script installed before real data is expected.
  - Missed-Call: needs phone forwarding before real captures are expected.
  - Demand/Buyer/Industry Pulse: can be marked active after first dashboard open or live count returned.

### 4. Fix digest delivery reliability and observability

- **Mortgage Radar**
  - Inspect why today’s function returned `digests_sent: 0` despite clients/leads.
  - Fix filtering so active clients with valid emails receive proof-of-work digests even on zero matching leads.
  - Add stronger heartbeat metadata: clients considered, clients skipped with reason, emails attempted, emails sent, errors.
  - Ensure the cron uses the service-role vault key pattern, not the public anon key.
- **SiteRadar**
  - Restore live cron for `site-radar-weekly-digest-monday` with the correct vault key.
  - Decide in code to include trial/provisioned SiteRadar clients, not only paid clients with `stripe_subscription_id`.
  - Add a retry cron similar to Mortgage Radar.
  - Add email-send logging so missing digests show up in `email_send_log`.
- **TechAlert / Talent Radar**
  - Add a retry cron for `techalert-weekly-digest-monday`.
  - Change the digest sender to log into `email_send_log` and heartbeat `sent/skipped/errors`.
  - Keep it weekly unless you want a separate daily Talent Radar digest; today’s “missing daily” expectation conflicts with the code comment/schedule that says weekly.
- After fixing, manually invoke the relevant digest functions with safe `force/debug` mode and report exactly which emails were attempted/sent/skipped.

### 5. Translate the screenshot/X concept into a possible DWA agent control-room UI

- Document the observed pattern as a DWA “Agent Command Center” concept:
  - real-time map/grid of agents;
  - agent status lanes (`scanning`, `enriching`, `writing`, `sending`, `waiting`, `blocked`);
  - product/channel nodes (Etsy-like equivalent for us: Stripe products, lead markets, email/SMS/fax/postcard channels);
  - live revenue/conversion/cost gauges;
  - per-agent log playback.
- If you want it built after these fixes, I’d implement it as an admin-only dashboard backed by `agent_heartbeats`, `email_send_log`, scanner logs, Stripe events, and OpenRouter spend — no fake animation, only real events.

## Files/areas likely to change

- `supabase/functions/_shared/openrouter.ts`
- Direct OpenRouter functions under `supabase/functions/*/index.ts`
- New migration for OpenRouter cap RPCs and `trial_hub_events`
- `supabase/functions/hub-summary/index.ts`
- New `supabase/functions/trial-hub-track/index.ts`
- `supabase/functions/send-ameristeel-hub-email/index.ts`
- `supabase/functions/send-teaser-email/index.ts` / `_shared/teaser-emails.ts` / `_shared/dwa-email.ts`
- `src/pages/TrialHub.tsx`
- Digest functions and cron migrations for Mortgage Radar, SiteRadar, and TechAlert

## Validation

- Query OpenRouter ledger after a simulated over-cap attempt and confirm calls are blocked at `$5/day`.
- Open the AmeriSteel hub with UTM params and confirm `trial_hub_events` records view/click/tile events.
- Confirm hub-summary returns progress state and the UI renders it.
- Manually trigger digest functions and verify `email_send_log` + `agent_heartbeats` show sent/skipped/error counts.
- Confirm SiteRadar and TechAlert weekly digest crons/retries appear in `cron.job` with recent successful runs.
- Make sure im enrolled in all radars like we have discussed so im getting the daily emails as if I were a real customer 