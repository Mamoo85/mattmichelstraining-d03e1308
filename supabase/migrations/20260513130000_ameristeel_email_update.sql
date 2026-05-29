-- Update AmeriSteel email from info@ameristeel.com to tdamman@ameristeel.com
-- across all provisioned product rows and trial_bundles.

UPDATE public.field_crm_clients
SET email = 'tdamman@ameristeel.com'
WHERE email = 'info@ameristeel.com';

UPDATE public.missed_call_clients
SET email = 'tdamman@ameristeel.com'
WHERE email = 'info@ameristeel.com';

UPDATE public.industry_pulse_clients
SET email = 'tdamman@ameristeel.com'
WHERE email = 'info@ameristeel.com';

-- Update trial_bundles: email column + demand_radar href (encodes email in URL)
UPDATE public.trial_bundles
SET
  email = 'tdamman@ameristeel.com',
  products = (
    SELECT jsonb_agg(
      CASE WHEN (p->>'key') = 'demand_radar'
        THEN jsonb_set(p, '{href}', to_jsonb(
          replace(p->>'href', 'info%40ameristeel.com', 'tdamman%40ameristeel.com')
        ))
        ELSE p
      END
    )
    FROM jsonb_array_elements(products) AS p
  )
WHERE bundle_token = 'ameristeel-2026-trial-hub';
