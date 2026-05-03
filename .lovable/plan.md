# Cold Email Audit Dashboard + E2E QA + 150-Email Live Test

## 1. Admin Audit Dashboard
Create `src/pages/admin/AdminColdEmailAudit.tsx` at route `/dwa-admin/cold-email-audit`:
- 14-day volume chart vs 150/day floor (red bars when below)
- Today's send count + per-template breakdown (deduped by `message_id`)
- Trial-period verification column: confirms hiring radars (techalert, carealert, talent-radar, mortgage-radar) = 30-day, all others = 7-day + 50% off 3 months
- Template preview pane (renders `dwaWrap` shell + CTA so we can visually confirm new look)
- "Run Now" buttons for each sender function (contractor-prospector, techalert-outreach, multi-service-drip, web-design-drip, prospect-local-businesses, techalert-followup-drip)
- Sentinel status card (last run, shortfall alerts, next scheduled run)
- Admin-only route guard via `AgencyAdminRoute`
- Link added to `DWAAdmin.tsx` Intel & Radars section

## 2. Pricing & Offer Lockdown
- Audit `_shared/dwa-email.ts` `dwaColdEmail()` to confirm hardcoded offer logic:
  - Hiring products → 30-day no-CC trial
  - All other monthly products → 7-day no-CC trial + 50% off first 3 months
- Verify all 6 sender functions pass correct `productType` so the helper picks the right CTA
- Confirm Stripe checkout functions apply the 50%-off coupon for non-hiring products (create coupon if missing)

## 3. End-to-End Customer Journey QA
Act as a real customer for each product family:
- Send a test email through each sender (contractor, techalert, multi-service, web-design, local-business, followup-drip)
- For each: open email → click CTA → verify landing page loads → click "Start Trial" → verify Stripe checkout opens with correct trial length + 50% off → verify success URL + welcome email
- Verify unsubscribe link, link tracking redirects, domain resolution
- Verify the new branded shell renders correctly (logo, colors, footer) in inbox preview
- Log results into the audit dashboard

## 4. Scanner & Targeting Audit
- Confirm all 13 scanners use `_shared/enrichment-pipeline.ts` (Apollo → Hunter → Firecrawl waterfall, aggregator filtering, Google Places fallback)
- Confirm targeting functions feed `outreach_leads` with full enrichment (owner name, email, phone, website)
- Spot-check 20 recent leads in DB for completeness; flag any with missing fields

## 5. Live 150-Email Test
- Invoke `cold-email-volume-sentinel` in `force` mode to top off to 150
- Monitor `email_send_log` in real time; verify:
  - 150 unique `message_id` rows with status `sent`
  - All use `dwaWrap` shell (template_name in approved list)
  - Trial CTAs match product type
  - Zero duplicates, zero suppressed-list violations
- If under 150, identify the bottleneck (lead supply, rate limit, enrichment failure) and fix

## 6. Floor Enforcement & Alerting
- Add 3 PM ET early-warning cron: if today's send count < 100, SMS Matt
- Add `cold_email_daily_floor` row to `system_health` table for ongoing visibility
- Confirm 9 PM sentinel SMSs Matt on any shortfall after final top-off attempt

## Deliverables
- New admin page + route
- Verified pricing/trial logic across all senders
- Documented E2E QA results in dashboard
- 150 emails sent and verified in `email_send_log`
- Two cron alerts (3 PM warning, 9 PM enforcement) confirmed scheduled

Approve and I'll execute all six steps in order.