-- Add missing pg_cron schedules for mortgage-radar pipeline.
-- Uses hardcoded URL + anon key pattern (vault secrets are NULL in cron context).

-- Daily scanner: 8am ET (13:00 UTC)
SELECT cron.unschedule('mortgage-radar-scanner-daily')
  WHERE EXISTS (SELECT FROM cron.job WHERE jobname = 'mortgage-radar-scanner-daily');

SELECT cron.schedule(
  'mortgage-radar-scanner-daily',
  '0 13 * * *',
  $$
  SELECT net.http_post(
    url := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/mortgage-radar-scanner',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVhdXZ1YmZwYW5wZXV4c3JxZXN1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2MzI3MDYsImV4cCI6MjA4OTIwODcwNn0.QF4PaTIhhwBkl0hgh68W4R2CxH22ReokGwJUebI2tKw"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

-- Weekly digest: Monday 8am ET (13:00 UTC)
SELECT cron.unschedule('mortgage-radar-weekly-digest')
  WHERE EXISTS (SELECT FROM cron.job WHERE jobname = 'mortgage-radar-weekly-digest');

SELECT cron.schedule(
  'mortgage-radar-weekly-digest',
  '0 13 * * 1',
  $$
  SELECT net.http_post(
    url := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/mortgage-radar-weekly-digest',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVhdXZ1YmZwYW5wZXV4c3JxZXN1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2MzI3MDYsImV4cCI6MjA4OTIwODcwNn0.QF4PaTIhhwBkl0hgh68W4R2CxH22ReokGwJUebI2tKw"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
