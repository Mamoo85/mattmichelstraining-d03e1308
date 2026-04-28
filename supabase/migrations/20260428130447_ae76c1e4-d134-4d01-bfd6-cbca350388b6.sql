-- Sprint D: Statewide MI sweep + enrichment cron schedules
-- Weekly sweep (Sun 6am ET = 11:00 UTC) — refreshes the prospect catalog
-- Backlog enrichment every 4 hours — drains unenriched statewide rows tier 1 → 3

DO $$
BEGIN
  -- Drop existing schedules if they exist (idempotent re-run safety)
  PERFORM cron.unschedule('contractor-statewide-sweep-weekly')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'contractor-statewide-sweep-weekly');

  PERFORM cron.unschedule('contractor-statewide-enrich-4h')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'contractor-statewide-enrich-4h');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'contractor-statewide-sweep-weekly',
  '0 11 * * 0', -- Sundays at 11:00 UTC (6am ET / 7am EDT)
  $$
  SELECT net.http_post(
    url := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/contractor-outreach-statewide-sweep',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVhdXZ1YmZwYW5wZXV4c3JxZXN1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2MzI3MDYsImV4cCI6MjA4OTIwODcwNn0.QF4PaTIhhwBkl0hgh68W4R2CxH22ReokGwJUebI2tKw"}'::jsonb,
    body := '{"tiers":["primary","secondary"],"max_seconds":90,"limit_per_query":20}'::jsonb
  );
  $$
);

SELECT cron.schedule(
  'contractor-statewide-enrich-4h',
  '15 */4 * * *', -- every 4 hours at :15 (offset to not collide with sweep)
  $$
  SELECT net.http_post(
    url := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/contractor-outreach-statewide-enrich',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVhdXZ1YmZwYW5wZXV4c3JxZXN1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2MzI3MDYsImV4cCI6MjA4OTIwODcwNn0.QF4PaTIhhwBkl0hgh68W4R2CxH22ReokGwJUebI2tKw"}'::jsonb,
    body := '{"max_seconds":90,"batch_size":5,"limit":60,"tiers":[1,2,3]}'::jsonb
  );
  $$
);