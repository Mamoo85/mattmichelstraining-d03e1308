
-- Standardize all crons to use SUPABASE_SERVICE_ROLE_KEY + vault URL pattern
-- These were created in 20260413073303 with hardcoded URLs + email_queue_service_role_key

-- 1. hire-alert-scanner — daily 11:00 UTC (7am ET)
SELECT cron.unschedule('hire-alert-scanner-daily')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'hire-alert-scanner-daily');

SELECT cron.schedule(
  'hire-alert-scanner-daily',
  '0 11 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/hire-alert-scanner',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- 2. hire-alert-phantom-alert — daily 12:30 UTC (8:30am ET)
SELECT cron.unschedule('hire-alert-phantom-alert-daily')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'hire-alert-phantom-alert-daily');

SELECT cron.schedule(
  'hire-alert-phantom-alert-daily',
  '30 12 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/hire-alert-phantom-alert',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- 3. hire-alert-trial-convert — daily 14:00 UTC (10am ET)
SELECT cron.unschedule('hire-alert-trial-convert-daily')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'hire-alert-trial-convert-daily');

SELECT cron.schedule(
  'hire-alert-trial-convert-daily',
  '0 14 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/hire-alert-trial-convert',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- 4. dead-lead-drip — daily 14:00 UTC (10am ET)
SELECT cron.unschedule('dead-lead-drip-daily')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'dead-lead-drip-daily');

SELECT cron.schedule(
  'dead-lead-drip-daily',
  '0 14 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/dead-lead-drip',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- 5. dead-lead-daily-notifier — daily 21:00 UTC (5pm ET)
SELECT cron.unschedule('dead-lead-daily-notifier')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'dead-lead-daily-notifier');

SELECT cron.schedule(
  'dead-lead-daily-notifier',
  '0 21 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/dead-lead-daily-notifier',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- 6. dead-lead-outreach-drip — daily 16:00 UTC (noon ET)
SELECT cron.unschedule('dead-lead-outreach-drip-daily')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'dead-lead-outreach-drip-daily');

SELECT cron.schedule(
  'dead-lead-outreach-drip-daily',
  '0 16 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/dead-lead-outreach-drip',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- 7. contractor-fomo-mailer — daily 19:00 UTC (3pm ET)
SELECT cron.unschedule('contractor-fomo-mailer-daily')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'contractor-fomo-mailer-daily');

SELECT cron.schedule(
  'contractor-fomo-mailer-daily',
  '0 19 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/contractor-fomo-mailer',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- 8. contractor-aged-lead-downsell — daily 18:00 UTC (2pm ET)
SELECT cron.unschedule('contractor-aged-lead-downsell-daily')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'contractor-aged-lead-downsell-daily');

-- Also unschedule the old name from 20260413000000
SELECT cron.unschedule('contractor-aged-lead-downsell')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'contractor-aged-lead-downsell');

SELECT cron.schedule(
  'contractor-aged-lead-downsell-daily',
  '0 18 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/contractor-aged-lead-downsell',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- 9. dwa-operator — every 4 hours
SELECT cron.unschedule('dwa-operator-4h')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'dwa-operator-4h');

SELECT cron.schedule(
  'dwa-operator-4h',
  '0 */4 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/dwa-operator',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- 10. dwa-closer — daily 18:00 UTC (2pm ET)
SELECT cron.unschedule('dwa-closer-daily')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'dwa-closer-daily');

SELECT cron.schedule(
  'dwa-closer-daily',
  '0 18 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/dwa-closer',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')
    ),
    body := '{}'::jsonb
  );
  $$
);
