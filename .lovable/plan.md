

# Deploy & Test Postcard Campaign Engine

All code is already written. This plan covers deploying the edge functions and doing a test run.

## Step 1: Deploy Edge Functions

Deploy all 3 postcard edge functions:
- `lara-business-scraper`
- `generate-postcard-copy`
- `send-postcards`

## Step 2: Test Run (Lob Test Mode)

1. Invoke `lara-business-scraper` to populate `postcard_prospects` with tri-county HVAC/plumbing businesses
2. Invoke `generate-postcard-copy` with `{ "county": "Macomb" }` to create copy variants with real stats
3. Verify data appears in admin panel
4. If Lob key is in test mode, send a test batch to verify the integration works end-to-end

## Step 3: Verify Landing Page

- Confirm `/techalert-postcard?ref=postcard&county=macomb` loads with real stats
- Confirm QR scan event logs to `postcard_conversions`
- Confirm Stripe checkout passes `ref=postcard` metadata

## Step 4: Conversion Tracking in Stripe Webhook

Verify that the existing `stripe-webhook` handler logs a `paid` event to `postcard_conversions` when a TechAlert subscription comes in with `ref=postcard` metadata. If not wired yet, add that handler.

## Technical Details

- No new tables or migrations needed — already deployed
- No new secrets needed — `LOB_API_KEY` already configured
- The `lara-business-scraper` uses OpenRouter/Sonar (`OPENROUTER_API_KEY` — already set)
- The `generate-postcard-copy` uses Lovable AI Gateway (`LOVABLE_API_KEY` — already set)

