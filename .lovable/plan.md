I found the failures. The current trial email system is sending one signed token format to every product, but several dashboards expect completely different product-specific tokens, and some trial products were never provisioned into their live client tables at all. The Trade Radar claim button is also rendered without any handler, so it cannot do anything.

Plan:

1. Fix the wrong mobile browser/header title
- Add the missing DWA dashboard routes to the brand/title detection list.
- Ensure all DWA portals set Detroit Web Agency / product-specific titles, not M² Training.
- Cover Trade Radar, FieldDesk, SiteRadar, Contractor Leads, Growth/Demand Radar, Missed Call, Mortgage Radar, and Talent Radar dashboard paths.

2. Fix Trade Radar “Claim Lead”
- Add a real claim handler to `TradeRadarPortal` and pass it into `TradeRadarLeadCard`.
- Validate the dashboard token/client before claiming.
- Record the claim as a lead action tied to Matt’s client row.
- Update the UI instantly so the button becomes claimed/call-owner instead of doing nothing.

3. Repair trial provisioning for every product Matt was enrolled in
- Update `start-radar-trial` so each product creates/updates the actual client row its dashboard reads:
  - Trade Radar verticals → `trade_radar_clients`
  - Growth/Demand Radar → `industry_pulse_clients`
  - SiteRadar / FieldDesk → `field_crm_clients`
  - Contractor Leads → `contractor_clients`
  - Missed Call → `missed_call_clients`
  - Mortgage Radar → `mortgage_radar_clients`
  - Talent Radar → `hire_alert_clients`
- Stop sending generic tokens to dashboards that require native dashboard tokens.
- Generate the correct dashboard URL per product before emailing.

4. Fix database/token mismatches blocking links
- Add or normalize missing dashboard-token fields where code already expects them, especially Missed Call.
- Backfill Matt’s founder/test rows with stable access tokens and active status.
- Preserve existing tokens where possible so old working links don’t break.

5. Add legacy-link rescue so old emails don’t dead-end
- For old `?email=...&token=signed-token&trial=...` links, resolve the trial row and redirect/load using the correct product-native token.
- This prevents today’s already-sent emails from continuing to fail after the code is fixed.

6. Audit every Matt trial link end-to-end
- Query every Matt enrollment row and token state.
- Test dashboard loading for all products shown in the emails/screenshots.
- Deploy the touched backend functions after code changes.
- Apply the required migration.

Target result:
- Claim Lead works.
- The browser title/header no longer says M² Training on DWA dashboards.
- Matt’s trial links open real dashboards instead of “Access Denied”.
- Old broken trial email links get rescued instead of staying broken.