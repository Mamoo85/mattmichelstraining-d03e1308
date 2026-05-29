-- AmeriSteel 30-day trial bundle for Tripp.
-- Powers /hub/ameristeel-2026-trial-hub via TrialHub.tsx → hub-summary edge function.
INSERT INTO public.trial_bundles (bundle_token, email, company_name, display_name, products, expires_at)
VALUES (
  'ameristeel-2026-trial-hub',
  'info@ameristeel.com',
  'AmeriSteel',
  'Tripp — AmeriSteel Trial Hub',
  '[
    {
      "key": "site_radar",
      "label": "SiteRadar",
      "tagline": "See which OEMs & Tier-1s are reading your site",
      "accent": "#00d4ff",
      "href": "/my-site-radar?token=7212599706cea3b465399108c2b1f264d93ffbda9cdc2502f781fdf1834e1a29"
    },
    {
      "key": "missed_call",
      "label": "Missed-Call Catch",
      "tagline": "Auto-text every dropped quote call in 12 seconds",
      "accent": "#22d3ee",
      "href": "/my-missed-call?token=59e738d9ccc359d7dab441a14735dbaf51a1f87dba0aded1e0e5a7394e4c478c",
      "count_table": "missed_call_captures"
    },
    {
      "key": "demand_radar",
      "label": "Demand Radar",
      "tagline": "Live RFPs, bid awards & procurement signals",
      "accent": "#34d399",
      "href": "https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/demand-radar-magic-link?email=info%40ameristeel.com"
    },
    {
      "key": "buyer_radar",
      "label": "Buyer Radar",
      "tagline": "Automotive Tier-1s showing buying-mode intent",
      "accent": "#f59e0b",
      "href": "/my-buyer-radar?token=cae5795a39f45c90b7339e9c6a6e5b3f0313d8444e0cb6c4656dd3f3dedb3fa6"
    },
    {
      "key": "industry_pulse",
      "label": "Industry Pulse",
      "tagline": "SE Michigan automotive market trends, weekly",
      "accent": "#a78bfa",
      "href": "/my-industry-pulse?token=cae5795a39f45c90b7339e9c6a6e5b3f0313d8444e0cb6c4656dd3f3dedb3fa6"
    }
  ]'::jsonb,
  NOW() + INTERVAL '30 days'
) ON CONFLICT (bundle_token) DO UPDATE SET
  products = EXCLUDED.products,
  expires_at = EXCLUDED.expires_at,
  updated_at = NOW();
