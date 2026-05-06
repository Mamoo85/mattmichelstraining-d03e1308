-- Fix web-design-drip cron: was pointing to legacy secondary project (zmyczlfuufhngzovkjdh).
-- Re-schedule to primary project (eauvubfpanpeuxsrqesu) at 10am ET (14:00 UTC) + 3pm ET (19:00 UTC).
-- Also adds a 2nd daily Trade Radar outreach run at 5pm ET (21:00 UTC) to double daily reach.

-- Remove old cron pointing to secondary project (ignore error if it doesn't exist)
SELECT cron.unschedule('web-design-drip-daily');

-- 10am ET (14:00 UTC) run
SELECT cron.schedule(
  'web-design-drip-10am',
  '0 14 * * *',
  $$
  SELECT net.http_post(
    url := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/web-design-drip',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY_VAULT')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- 3pm ET (19:00 UTC) run
SELECT cron.schedule(
  'web-design-drip-3pm',
  '0 19 * * *',
  $$
  SELECT net.http_post(
    url := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/web-design-drip',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY_VAULT')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- 2nd daily Trade Radar outreach run at 5pm ET (21:00 UTC)
-- Complements the existing 11am ET run; together they can reach 960 homeowners/day (40×12×2)
SELECT cron.schedule(
  'trade-radar-outreach-5pm',
  '0 21 * * *',
  $$
  SELECT net.http_post(
    url := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/trade-radar-outreach',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY_VAULT')
    ),
    body := '{}'::jsonb
  );
  $$
);
