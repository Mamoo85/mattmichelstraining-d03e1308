-- Fix hire-alert-healthcare and hire-alert-industrial crons.
-- Previous commands used vault.decrypted_secrets lookups (project_url / service_role_key)
-- that return null on the primary project, so net.http_post fired with a null URL and
-- the function was never invoked.  Same fix already applied to the Kalshi cron (job 124):
-- hardcode the primary project URL and anon key directly in the pg_cron command string.

SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname IN ('hire-alert-healthcare-1am-et', 'hire-alert-industrial-2am-et');

-- 1am ET (5am UTC): healthcare-focused hire-alert pass
SELECT cron.schedule(
  'hire-alert-healthcare-1am-et',
  '0 5 * * *',
  $$
  SELECT net.http_post(
    url     := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/hire-alert-scanner',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJ.REDACTED.JWT"}'::jsonb,
    body    := '{"vertical_filter":"healthcare","triggered_by":"cron_round_robin"}'::jsonb
  );
  $$
);

-- 2am ET (6am UTC): industrial/trades hire-alert pass
SELECT cron.schedule(
  'hire-alert-industrial-2am-et',
  '0 6 * * *',
  $$
  SELECT net.http_post(
    url     := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/hire-alert-scanner',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJ.REDACTED.JWT"}'::jsonb,
    body    := '{"vertical_filter":"industrial","triggered_by":"cron_round_robin"}'::jsonb
  );
  $$
);
