-- Marketplace background worker cron schedules.
-- These functions existed in config.toml but had zero scheduled triggers.
-- Uses hardcoded URL + anon key (vault secrets are NULL in cron context).

-- Weekly scorecard: Monday 9am ET (14:00 UTC)
SELECT cron.unschedule('marketplace-weekly-scorecard')
  WHERE EXISTS (SELECT FROM cron.job WHERE jobname = 'marketplace-weekly-scorecard');

SELECT cron.schedule(
  'marketplace-weekly-scorecard',
  '0 14 * * 1',
  $$
  SELECT net.http_post(
    url := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/marketplace-weekly-scorecard',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVhdXZ1YmZwYW5wZXV4c3JxZXN1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2MzI3MDYsImV4cCI6MjA4OTIwODcwNn0.QF4PaTIhhwBkl0hgh68W4R2CxH22ReokGwJUebI2tKw"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

-- Re-engagement: Wednesday 10am ET (15:00 UTC) — mid-week nudge to inactive buyers
SELECT cron.unschedule('marketplace-reengagement-weekly')
  WHERE EXISTS (SELECT FROM cron.job WHERE jobname = 'marketplace-reengagement-weekly');

SELECT cron.schedule(
  'marketplace-reengagement-weekly',
  '0 15 * * 3',
  $$
  SELECT net.http_post(
    url := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/marketplace-reengagement',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVhdXZ1YmZwYW5wZXV4c3JxZXN1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2MzI3MDYsImV4cCI6MjA4OTIwODcwNn0.QF4PaTIhhwBkl0hgh68W4R2CxH22ReokGwJUebI2tKw"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

-- Hot-zone notifier: daily 8am ET (13:00 UTC)
SELECT cron.unschedule('marketplace-hot-zone-notifier-daily')
  WHERE EXISTS (SELECT FROM cron.job WHERE jobname = 'marketplace-hot-zone-notifier-daily');

SELECT cron.schedule(
  'marketplace-hot-zone-notifier-daily',
  '0 13 * * *',
  $$
  SELECT net.http_post(
    url := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/marketplace-hot-zone-notifier',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVhdXZ1YmZwYW5wZXV4c3JxZXN1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2MzI3MDYsImV4cCI6MjA4OTIwODcwNn0.QF4PaTIhhwBkl0hgh68W4R2CxH22ReokGwJUebI2tKw"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

-- Saved-search notifier: daily 9am ET (14:00 UTC) — alerts buyers when matching leads drop
SELECT cron.unschedule('marketplace-saved-search-notifier-daily')
  WHERE EXISTS (SELECT FROM cron.job WHERE jobname = 'marketplace-saved-search-notifier-daily');

SELECT cron.schedule(
  'marketplace-saved-search-notifier-daily',
  '0 14 * * *',
  $$
  SELECT net.http_post(
    url := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/marketplace-saved-search-notifier',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVhdXZ1YmZwYW5wZXV4c3JxZXN1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2MzI3MDYsImV4cCI6MjA4OTIwODcwNn0.QF4PaTIhhwBkl0hgh68W4R2CxH22ReokGwJUebI2tKw"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
