I found the likely failure pattern: the Trade Radar trial flow is split between two systems. Some links use `start-radar-trial` magic links, but `/start-trial?product=foundation_radar` and similar currently route through `create-trade-radar-checkout`, which creates a Stripe checkout and then sends users back to dashboards without the required token. Old emails also need a legacy-link rescue because already-sent links may contain the older generic trial token instead of the native dashboard token.

Plan:

1. Fix every Trade Radar trial link path
- Make all no-card Trade Radar trials use `start-radar-trial` consistently for roofing, HVAC, plumbing, electrical, pest, gutters, exterior, tree, restoration, demo/junk, and foundation.
- Keep paid checkout links separate so working paid links are not broken.
- Ensure dashboard URLs always include the correct token format for the dashboard being opened.

2. Add legacy-link rescue for already-sent broken emails
- Update the Trade Radar dashboard loader/function so old links with `email`, `token`, and/or `trial` can resolve through `radar_trials`.
- If the old trial row is valid, look up the matching native `trade_radar_clients` row and load the dashboard instead of showing “not enrolled.”
- This is what should rescue the screenshots you posted without making you resend everything first.

3. Verify and repair Matt’s trial enrollments
- Audit Matt’s rows across all product tables, not just `radar_trials`.
- Backfill or repair missing native dashboard tokens for every enrolled product.
- Verify each dashboard returns real data or a legitimate warming-up state.

4. Fix Claim Lead fully
- Move lead claiming into a backend function or secured RPC so token-based dashboard users can claim without being blocked by row-level security.
- The current frontend direct insert can fail because the dashboard link user is not necessarily logged in.
- After claim, update the card state immediately and show owner contact/call actions.

5. Fix DWA branding/title bleed
- Make all DWA dashboards, trial pages, not-found pages reached from DWA routes, and bundle pages use Detroit Web Agency titles.
- Remove the M² Training browser-title bleed on `detroitwebagent.com`.

6. Clean up the dashboard UI without breaking links
- Improve spacing, mobile layout, nav highlighting, empty states, and token error states.
- Make not-enrolled/error screens more useful: “rescue link,” “text Matt,” and “open My Trials.”
- Preserve every existing route and add redirects only where needed.

7. Sharpen lead cards
- Make lead cards denser and clearer: stronger address hierarchy, score strip, source confidence, best-call window, job value, owner-contact block, and clearer claim/pass/snooze actions.
- Improve mobile formatting so the CTA does not feel buried.
- Keep Street View and existing lead action buttons working.

8. Add a trial-link verification harness
- Create an admin-only/auditor function or page that checks each generated trial URL for: route exists, token accepted, client row exists, leads load, and branding title is DWA.
- Use it to verify all current Matt links before any re-email campaign.

9. Build visual preview for the new outreach email
- Add an admin preview for the reactivation email with subject/body variants.
- Subject direction: “Nothing to lose. Local leads waiting in your free trial.”
- Email emphasis: no credit card, trial membership first, sample lead preview, one-click dashboard button, and “reply/text Matt” fallback.

10. Reactivation outreach safely, not a blind blast
- I will not auto-send a bulk blast without verification and guardrails.
- Build a queued reactivation campaign for cold-email recipients from the last 3 weeks.
- Apply suppression/blocklist checks, reply exclusion, bounce exclusion, frequency caps, and manual approval before send.
- After trial links are verified, send only to eligible recipients and log every send.

10 ways I’d enhance this if it were my business:

1. “My Trials” becomes the universal rescue hub: every email link can fall back there.
2. Add one-click “Send me a fresh login link” on every access-denied screen.
3. Add a “Live sample lead” preview inside every trial email so the value is visible before clicking.
4. Add per-product dashboard health badges: token OK, enrollment OK, scanner OK, leads found.
5. Add lead-card confidence proof: source, date found, why it matters, and recommended call script.
6. Add “Call queue” mode so Matt/customers can work leads one by one like a sales dialer.
7. Add “credit request” directly on each lead card instead of mailto-only.
8. Add vertical-specific empty states with real sample lead cards, not generic warming-up copy.
9. Add admin “impersonate/access test link” for each customer/product without exposing private tokens in UI.
10. Add reactivation-email A/B testing with subject, preview text, lead-preview block, and CTA tracking.

Technical details:
- Files likely involved: `StartTrial.tsx`, `start-radar-trial`, `trade-radar-dashboard`, `TradeRadarPortal`, `TradeRadarLeadCard`, `SEOHead`, `NotFound`, and one new backend function/RPC for lead claiming.
- Database changes likely needed: a safe backend claim path and possibly a small audit/log table for trial-link verification and reactivation sends.
- Deployment needed after implementation: deploy `start-radar-trial`, `trade-radar-dashboard`, new claim/verification functions, and apply any migration.

Acceptance checklist:
- Foundation, Tree, Restoration, Demo/Junk, Exterior, and all older Trade Radar links open dashboards with no “not enrolled” false negatives.
- Claim Lead works from token-based dashboard links.
- DWA pages no longer show M² Training titles.
- Lead cards look cleaner and sharper on mobile.
- Re-email campaign has visual preview, verified links, suppression checks, and manual approval before sending.