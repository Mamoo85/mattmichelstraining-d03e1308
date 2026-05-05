-- Schedule cold-email blasts for FieldDesk and SiteRadar (weekday mornings ET)
-- Uses canonical hardcoded URL + SUPABASE_SERVICE_ROLE_KEY_VAULT pattern.

SELECT cron.unschedule('fielddesk-cold-blast-daily') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='fielddesk-cold-blast-daily');
SELECT cron.unschedule('siteradar-cold-blast-daily') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='siteradar-cold-blast-daily');

SELECT cron.schedule(
  'fielddesk-cold-blast-daily',
  '30 14 * * 1-5',  -- 9:30am ET weekdays
  $$
  SELECT net.http_post(
    url := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/fielddesk-cold-blast',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY_VAULT')
    ),
    body := '{}'::jsonb
  );
  $$
);

SELECT cron.schedule(
  'siteradar-cold-blast-daily',
  '0 15 * * 1-5',  -- 10am ET weekdays
  $$
  SELECT net.http_post(
    url := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/siteradar-cold-blast',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY_VAULT')
    ),
    body := '{}'::jsonb
  );
  $$
);