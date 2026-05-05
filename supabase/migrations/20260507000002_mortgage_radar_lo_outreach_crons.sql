-- Wire Mortgage Radar LO outreach 3-step daily pipeline (#4)
-- Functions exist but were never scheduled. Each LO client is worth ~$1,790 LTV.
-- Pipeline: 8am find prospects → 9am enrich → 10am send outreach

-- Step 1: find-lo-prospects — 8am ET (12:00 UTC)
SELECT cron.schedule(
  'find-lo-prospects-daily',
  '0 12 * * *',
  $$
  SELECT net.http_post(
    url := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/find-lo-prospects',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY_VAULT')),
    body := '{}'::jsonb
  )
  $$
);

-- Step 2: enrich-lo-prospect — 9am ET (13:00 UTC)
SELECT cron.schedule(
  'enrich-lo-prospect-daily',
  '0 13 * * *',
  $$
  SELECT net.http_post(
    url := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/enrich-lo-prospect',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY_VAULT')),
    body := '{}'::jsonb
  )
  $$
);

-- Step 3: mortgage-radar-outreach — 10am ET (14:00 UTC)
SELECT cron.schedule(
  'mortgage-radar-outreach-daily',
  '0 14 * * *',
  $$
  SELECT net.http_post(
    url := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/mortgage-radar-outreach',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY_VAULT')),
    body := '{}'::jsonb
  )
  $$
);
