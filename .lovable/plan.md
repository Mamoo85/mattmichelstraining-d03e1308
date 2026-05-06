# Deep Post-Purchase Audit — Ready by Tonight

## Status of Claude's 4 critical fixes (already verified in code)

| Fix | Status |
|---|---|
| FieldDesk webhook type → `field_crm_subscription` | ✅ confirmed in `create-field-service-checkout/index.ts:73` |
| `claim-session` PRODUCT_NAMES expanded (7 new) | ✅ all 7 product types present |
| Trade Radar `trial=success` friendly screen | ✅ `justPurchased` flag in `TradeRadarPortal.tsx:59` |
| Buyer Radar `PostCheckoutClaim` + `session_id` | ✅ imported & rendered on `success` |
| Zero `detroitwebagency.com` references | ✅ ripgrep confirms 0 matches |
| `/billing` + `/demand-radar-portal` routes | ✅ both wired in `App.tsx` |

Code-level fixes look clean. Now we click-test reality.

## Audit plan (in priority order)

### Phase 1 — Browser click-test all 19 customer portals (mobile viewport, matches user's 400×833)
For each route, load with `?trial=success&session_id=cs_test_audit` and verify:
- Page renders (no white screen / error boundary)
- No "Access denied" without graceful messaging
- Console has no red errors
- Network has no 4xx/5xx on critical calls

Routes to test:
1. `/my-roofing-radar` through `/my-foundation-radar` (11 Trade Radar)
2. `/my-mortgage-radar`, `/my-missed-call`, `/my-site-radar`, `/my-fielddesk`, `/talent-radar` (TechAlert), `/my-buyer-radar`, `/my-demand-radar`, `/my-contractor-leads` (8 core)
3. `/billing` (new Stripe portal page)
4. `/demand-radar-portal` (verify redirect works)

### Phase 2 — Full chain audit (checkout → webhook → email → portal) for ~15 products
For each product, verify all 4 links exist and match:
1. `create-<product>-checkout/index.ts` has correct `metadata.type` AND `success_url` includes `session_id={CHECKOUT_SESSION_ID}`
2. `stripe-webhook/index.ts` has matching `meta.type === "..."` handler that provisions DB row
3. Welcome email sent (either inside webhook or via `claim-session`)
4. Portal route exists and accepts the user post-checkout

Products in scope: FieldDesk, TechAlert, SiteRadar, Missed-Call, Mortgage Radar, Contractor Leads, Dead Lead, Trade Radar (×11), Buyer Radar, Demand Radar, Bundle Revenue Suite, Marketplace.

### Phase 3 — Post-checkout magic-link flow live test
- Hit `claim-session` directly with a synthetic `session_id` and verify email send code path doesn't throw
- Verify `dwa-email.ts` `fromAddress` is now `matt@detroitwebagent.com` (not `agency`)
- Check Resend API key is set in secrets

### Phase 4 — Fix immediately + report
- Any bug found gets fixed inline (one focused commit per bug)
- After fixes, re-test the affected route
- Final summary lists: ✅ verified working, 🔧 found+fixed, ⚠️ flagged for Matt

## Out of scope (can be added if time permits)
- Stripe test-mode end-to-end charges (you said no)
- Email deliverability testing (would need real inbox)
- Cron job verification (last audit covered this)

## Deliverable
A single status report at the end with green/yellow/red on every product's post-purchase chain, and any new fixes pushed to main.
