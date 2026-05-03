-- Weekly cron: contractor-lead-prospector — Apollo.io sweep for MI home service companies
-- Runs Sunday 12:00 UTC (7:00am ET) — weekly cadence to avoid Apollo rate limits

SELECT cron.schedule(
  'contractor-lead-prospector-weekly',
  '0 12 * * 0',  -- Sunday 12:00 UTC (7am ET)
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/contractor-lead-prospector',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer " || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = ''SUPABASE_SERVICE_ROLE_KEY'')}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
