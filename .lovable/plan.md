

# Livonia Onboarding — Premium Offer + Dashboard Upgrade

## What changes in the SMS to the electrician
- **No 7-day free trial** (we're spending on ads — pay starts day 1)
- **Cancel anytime + 30-day money-back guarantee** if zero leads delivered
- **Bonus stack** included free with the $399/mo:
  - 🎁 Missed Call Text-Back ($99/mo value) — never lose another caller
  - 🎁 Review Monitor ($25/mo value) — Google review alerts + reply drafts
  - 🎁 After-Job Drip ($29/mo value) — auto follow-up on completed jobs
  - 🎁 Lead dashboard with 1-tap call/hire/dispute tracking
- **Add-on shop in dashboard** at heavy bundle discount (30% off all DWA add-ons for active lead-network clients)
- **Honesty line**: "The dashboard is brand new — we're shipping upgrades almost daily. Bare with us as it gets better."

## Dashboard changes (MyContractorLeads.tsx)

### 1. Add "🎁 Included Free" strip at top
Shows the 3 bonus services bundled in (Missed Call, Reviews, After-Job Drip) with a one-click "Activate" link that pre-fills their info into each product's $0 internal checkout (no separate card capture — flagged as "bundled" in DB).

### 2. Add "🛒 Upgrade Shop" section (collapsible)
Card grid with bundle-discounted DWA add-ons:

| Add-on | Standalone | Bundled (30% off) |
|---|---|---|
| TechAlert (hiring monitor) | $149/mo | $104/mo |
| FieldDesk (dispatch CRM) | $199/mo | $139/mo |
| SiteRadar (visitor intel) | $49/mo | $34/mo |
| Seasonal Promo Blaster | $29/mo | $20/mo |
| Estimate Follow-Up Drip | $39/mo | $27/mo |
| Weekly SMS Blast | $19/mo | $13/mo |

Each card → "Add to my plan" button that fires the existing `create-*-checkout` edge function with a `?bundle_discount=lead_network` flag and prefilled email.

### 3. Add "🚧 New Dashboard — Shipping Upgrades Daily" banner
Subtle amber banner under the header. Sets honest expectations + builds goodwill.

### 4. Fix dashboard test
Before sending SMS, hit the live `contractor-leads-dashboard` endpoint with the electrician's `roi_token` (created on Stripe checkout success) and confirm:
- Loads without error
- Shows his business name + Livonia + Electrical
- Stats display (will be 0/0 — that's correct for new account)
- Filter buttons render
- Empty state copy reads correctly

If anything fails, fix before sending.

## Backend changes

### `create-contractor-checkout/index.ts`
- Remove `subscription_data: { trial_period_days: 7 }` (line 60)
- Update product description to mention bonus stack:
  > "Exclusive {trade} territory in {city}. Includes free Missed Call Text-Back ($99/mo), Review Monitor ($25/mo), After-Job Drip ($29/mo). Cancel anytime. 30-day money-back guarantee if zero leads delivered."
- Keep $399/mo pricing

### `stripe-webhook` `contractor_lead_subscription` handler
- On successful checkout, **auto-provision** the 3 free add-ons:
  - Insert row into `missed_call_clients` with `bundled_from = 'contractor_leads'`, `business_phone = contractor.phone`, `business_name`
  - Insert row into `review_monitor_clients` (bundled flag)
  - Insert row into `afterjob_drip_clients` (bundled flag)
- Each gets `monthly_price = 0` so they don't bill separately
- Welcome email lists all 4 things they got + dashboard link

### Migration: `bundled_from` columns
Add nullable `bundled_from text` to:
- `missed_call_clients`
- `review_monitor_clients`
- `afterjob_drip_clients`

Allows tracking which freebies came from a lead-network sub. If they cancel the lead sub, we can downgrade or notify (later — V1 just leaves them active as goodwill).

### `contractor-leads-dashboard/index.ts`
Extend the GET response to include:
- `bundled_services: { missed_call: bool, reviews: bool, afterjob: bool }` — checks the 3 client tables for matching email
- `available_upgrades: [...]` — static list of add-ons with bundled price

## SMS draft for Livonia (after all of above)

> Locked in 1 sec. Livonia electrical leads = $399/mo flat — no setup fee, no contract, cancel anytime. **30-day refund if you don't get a single lead.** Plus you get free: Missed Call Text-Back ($99 value), Review Monitor ($25), After-Job Follow-Up ($29). Total bundled value $552/mo, you pay $399. Card link: [Stripe checkout]. Once paid, dashboard link comes via text + email — track every lead, mark hires, request refund on junk leads in 1 tap. Dashboard is brand new so bare with us, shipping updates daily. — Matt, Detroit Web Agency

## Order of operations after approval
1. Build migration + edge function changes + UI
2. Test the dashboard with a real fake `roi_token` (insert + GET + verify response)
3. Text Matt the final SMS draft to approve
4. On Matt's "A" → send to electrician
5. Update memory: `mem://business/contractor-leads-pricing` (no trial, 30-day guarantee, bundled stack)

## Files changed
- `supabase/functions/create-contractor-checkout/index.ts` — remove trial, update copy
- `supabase/functions/stripe-webhook/index.ts` — auto-provision 3 free add-ons in `contractor_lead_subscription` handler
- `supabase/functions/contractor-leads-dashboard/index.ts` — return bundled + upgrade data
- `src/pages/MyContractorLeads.tsx` — add "Included Free" strip, "Upgrade Shop" section, "Shipping Upgrades Daily" banner
- New migration: `bundled_from` columns on 3 client tables
- `mem://business/contractor-leads-pricing` — update pricing rules

