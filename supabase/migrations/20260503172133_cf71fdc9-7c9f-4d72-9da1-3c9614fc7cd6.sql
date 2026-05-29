-- Cold-email rebalancer hourly 11am-8pm ET (16:00-01:00 UTC)
SELECT cron.unschedule('cold-email-rebalancer-hourly') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='cold-email-rebalancer-hourly');
SELECT cron.schedule(
  'cold-email-rebalancer-hourly',
  '0 16-23,0,1 * * *',
  $$ SELECT net.http_post(
    url := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/cold-email-rebalancer',
    headers := '{"Content-Type":"application/json","apikey":"eyJ.REDACTED.JWT"}'::jsonb,
    body := '{}'::jsonb
  ); $$
);

-- 3pm ET early-warning sentinel (20:00 UTC) — invokes existing sentinel which then forwards to rebalancer
SELECT cron.unschedule('cold-email-sentinel-3pm') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='cold-email-sentinel-3pm');
SELECT cron.schedule(
  'cold-email-sentinel-3pm',
  '0 20 * * *',
  $$ SELECT net.http_post(
    url := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/cold-email-volume-sentinel',
    headers := '{"Content-Type":"application/json","apikey":"eyJ.REDACTED.JWT"}'::jsonb,
    body := '{}'::jsonb
  ); $$
);

-- Bump techalert-prospect-hunter from 1x/day to 3x/day (8a/1p/6p ET = 13/18/23 UTC)
SELECT cron.unschedule('techalert-prospect-hunter-daily') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='techalert-prospect-hunter-daily');
SELECT cron.schedule(
  'techalert-prospect-hunter-3x',
  '0 13,18,23 * * *',
  $$ SELECT net.http_post(
    url := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/techalert-prospect-hunter',
    headers := '{"Content-Type":"application/json","apikey":"eyJ.REDACTED.JWT"}'::jsonb,
    body := '{}'::jsonb
  ); $$
);

-- Bump contractor-prospector to 2x/day (10a, 4p ET = 15/21 UTC)
SELECT cron.unschedule('contractor-prospector-daily') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='contractor-prospector-daily');
SELECT cron.schedule(
  'contractor-prospector-2x',
  '0 15,21 * * *',
  $$ SELECT net.http_post(
    url := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/contractor-prospector',
    headers := '{"Content-Type":"application/json","apikey":"eyJ.REDACTED.JWT"}'::jsonb,
    body := '{}'::jsonb
  ); $$
);

-- Bump prospect-local-businesses to 2x/day (10a, 3p ET = 15/20 UTC)
SELECT cron.unschedule('prospect-local-businesses') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='prospect-local-businesses');
SELECT cron.schedule(
  'prospect-local-businesses-2x',
  '0 15,20 * * *',
  $$ SELECT net.http_post(
    url := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/prospect-local-businesses',
    headers := '{"Content-Type":"application/json","apikey":"eyJ.REDACTED.JWT"}'::jsonb,
    body := '{}'::jsonb
  ); $$
);

-- outreach-leads-enrich every 2 hours to drain the 1,376 backlog
SELECT cron.unschedule('outreach-leads-enrich-2h') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='outreach-leads-enrich-2h');
SELECT cron.schedule(
  'outreach-leads-enrich-2h',
  '15 */2 * * *',
  $$ SELECT net.http_post(
    url := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/outreach-leads-enrich',
    headers := '{"Content-Type":"application/json","apikey":"eyJ.REDACTED.JWT"}'::jsonb,
    body := '{"batch": 30}'::jsonb
  ); $$
);