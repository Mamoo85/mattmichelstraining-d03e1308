-- Bump outreach-leads-enrich to every hour, batch 60
SELECT cron.unschedule('outreach-leads-enrich-2h') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='outreach-leads-enrich-2h');
SELECT cron.unschedule('outreach-leads-enrich-1h') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='outreach-leads-enrich-1h');
SELECT cron.schedule(
  'outreach-leads-enrich-1h',
  '15 * * * *',
  $$ SELECT net.http_post(
    url := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/outreach-leads-enrich',
    headers := '{"Content-Type":"application/json","apikey":"eyJ.REDACTED.JWT"}'::jsonb,
    body := '{"batch": 60}'::jsonb
  ); $$
);

-- Bump techalert-enrich to every 2 hours, batch 50
SELECT cron.unschedule('techalert-enrich-daily') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='techalert-enrich-daily');
SELECT cron.unschedule('techalert-enrich-2h') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='techalert-enrich-2h');
SELECT cron.schedule(
  'techalert-enrich-2h',
  '30 */2 * * *',
  $$ SELECT net.http_post(
    url := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/techalert-enrich',
    headers := '{"Content-Type":"application/json","apikey":"eyJ.REDACTED.JWT"}'::jsonb,
    body := '{"limit": 50}'::jsonb
  ); $$
);