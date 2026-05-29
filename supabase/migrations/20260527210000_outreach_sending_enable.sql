-- Task A Step 4: Enable sending crons — techalert-outreach + followup-drip + dwa-product-blast
-- Matt explicitly approved 2026-05-27 after hunting crons confirmed running and deliverability passed.
--
-- UTC offset: ET = UTC-4 (summer). 8am ET = 12:00 UTC. 9am ET = 13:00 UTC.
-- 2pm ET = 18:00 UTC. 11am ET = 15:00 UTC. 7pm ET = 23:00 UTC.
--
-- All three functions respect:
--   - cold_email_ramp_state (paused flag + daily cap, currently 25/day)
--   - outreach-blocklist table
--   - 60-email/day hard cap in prospect-local-businesses

-- techalert-outreach — 8am ET (12:00 UTC) daily
-- Sends proof-before-pitch cold emails to prospects with lead_score >= 7/10.
SELECT cron.unschedule(jobname) FROM cron.job WHERE jobname IN (
  'techalert-outreach',
  'techalert-outreach-daily'
);
SELECT cron.schedule(
  'techalert-outreach',
  '0 12 * * *',
  $$SELECT net.http_post(
    url:='https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/techalert-outreach',
    headers:='{"Content-Type":"application/json"}'::jsonb,
    body:='{}'::jsonb
  )$$
);

-- techalert-followup-drip — 9am ET + 2pm ET (13:00 + 18:00 UTC) daily
-- D3 urgency, D7 social proof, D14 phone offer sequences.
SELECT cron.unschedule(jobname) FROM cron.job WHERE jobname IN (
  'techalert-followup-drip',
  'techalert-followup-drip-daily'
);
SELECT cron.schedule(
  'techalert-followup-drip',
  '0 13,18 * * *',
  $$SELECT net.http_post(
    url:='https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/techalert-followup-drip',
    headers:='{"Content-Type":"application/json"}'::jsonb,
    body:='{}'::jsonb
  )$$
);

-- dwa-product-blast — 11am ET + 7pm ET (15:00 + 23:00 UTC) daily
-- Routes by industry to best-fit DWA product. Hard cap: 200/day.
SELECT cron.unschedule(jobname) FROM cron.job WHERE jobname IN (
  'dwa-product-blast',
  'dwa-product-blast-daily'
);
SELECT cron.schedule(
  'dwa-product-blast',
  '0 15,23 * * *',
  $$SELECT net.http_post(
    url:='https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/dwa-product-blast',
    headers:='{"Content-Type":"application/json"}'::jsonb,
    body:='{}'::jsonb
  )$$
);
