-- Fix mortgage-radar-enrich-drain cron: vault secrets are NULL in cron context,
-- causing the http_post URL to be NULL and the job to fail every 10 min.
-- Replace with the same hardcoded pattern used by mortgage-radar-scanner-daily.

SELECT cron.unschedule('mortgage-radar-enrich-drain');

SELECT cron.schedule(
  'mortgage-radar-enrich-drain',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/mortgage-radar-enrich-drain',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJ.REDACTED.JWT"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

-- Same fix for the am-digest cron, which has the same broken pattern
SELECT cron.unschedule('mortgage-radar-am-digest');

SELECT cron.schedule(
  'mortgage-radar-am-digest',
  '30 11 * * *',
  $$
  SELECT net.http_post(
    url := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/mortgage-radar-am-digest',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJ.REDACTED.JWT"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);