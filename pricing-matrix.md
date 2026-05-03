# Pricing & Offer Matrix — 2026-05-03

Source of truth: `supabase/functions/_shared/offers.ts`
Stripe coupon: `INTRO50_3MO` (id `s5f2M1Vq`) — 50% off, repeating 3 months.

| Product | Monthly | 7-Day No-CC Trial | 50% × 3 mo Coupon | Notes |
|---|---|:---:|:---:|---|
| Mortgage Radar | $399 | ✅ | ✅ | LO single-seat |
| Trade Radar (per vertical) | $149 | ✅ | ✅ | 11 verticals |
| FieldDesk | $199 | ✅ | ✅ | Standard tier |
| SiteRadar | $49 | ✅ | ✅ | |
| Missed-Call Catch | $99 | ✅ | ✅ | |
| AI Phone Answering | $149 | ✅ | ✅ | |
| Bundle Revenue Suite | $299 | ✅ | ✅ | |
| **TechAlert (Hiring Radar)** | $149 | ❌ | ❌ | Hiring radar — exempted per directive |
| **Contractor Leads** | $399 | ❌ | ❌ | Exempted per directive |
| **Dead Lead Reactivation** | $50/yes | ❌ | ❌ | **First yes is FREE**; $50 each after |

## What changed

- Created `_shared/offers.ts` — every checkout, email, fax, postcard, SMS, ad must read offer copy + trial logic from here.
- Created Stripe coupon `INTRO50_3MO` once — reused across all eligible products.
- Standardized `/start-trial?product=<key>` as the single CTA path for every outbound asset.

## Next: Phase 0 wiring

I'm now editing the 7 trial-eligible checkout functions to:
1. Add `subscription_data.trial_period_days = 7` (where missing).
2. Add `discounts: [{ coupon: 's5f2M1Vq' }]`.
3. Set `payment_method_collection: 'if_required'`.
