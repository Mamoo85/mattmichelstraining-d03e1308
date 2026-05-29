
-- Fix contractor-lead-notify: replace anon key with vault service_role
SELECT cron.unschedule('contractor-lead-notify');

SELECT cron.schedule(
  'contractor-lead-notify',
  '*/15 * * * *',
  $$
  SELECT extensions.http_post(
    url:='https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/contractor-lead-notify',
    headers:=jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer '||(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='email_queue_service_role_key' LIMIT 1)
    ),
    body:='{}'::jsonb
  )
  $$
);

-- 1. hire-alert-scanner — daily 11:00 UTC (7am ET)
SELECT cron.schedule(
  'hire-alert-scanner-daily',
  '0 11 * * *',
  $$
  SELECT extensions.http_post(
    url:='https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/hire-alert-scanner',
    headers:=jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer '||(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='email_queue_service_role_key' LIMIT 1)
    ),
    body:='{}'::jsonb
  )
  $$
);

-- 2. hire-alert-phantom-alert — daily 12:30 UTC (8:30am ET)
SELECT cron.schedule(
  'hire-alert-phantom-alert-daily',
  '30 12 * * *',
  $$
  SELECT extensions.http_post(
    url:='https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/hire-alert-phantom-alert',
    headers:=jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer '||(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='email_queue_service_role_key' LIMIT 1)
    ),
    body:='{}'::jsonb
  )
  $$
);

-- 3. hire-alert-trial-convert — daily 14:00 UTC (10am ET)
SELECT cron.schedule(
  'hire-alert-trial-convert-daily',
  '0 14 * * *',
  $$
  SELECT extensions.http_post(
    url:='https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/hire-alert-trial-convert',
    headers:=jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer '||(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='email_queue_service_role_key' LIMIT 1)
    ),
    body:='{}'::jsonb
  )
  $$
);

-- 4. dead-lead-drip — daily 14:00 UTC (10am ET)
SELECT cron.schedule(
  'dead-lead-drip-daily',
  '0 14 * * *',
  $$
  SELECT extensions.http_post(
    url:='https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/dead-lead-drip',
    headers:=jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer '||(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='email_queue_service_role_key' LIMIT 1)
    ),
    body:='{}'::jsonb
  )
  $$
);

-- 5. dead-lead-daily-notifier — daily 21:00 UTC (5pm ET)
SELECT cron.schedule(
  'dead-lead-daily-notifier',
  '0 21 * * *',
  $$
  SELECT extensions.http_post(
    url:='https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/dead-lead-daily-notifier',
    headers:=jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer '||(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='email_queue_service_role_key' LIMIT 1)
    ),
    body:='{}'::jsonb
  )
  $$
);

-- 6. dead-lead-outreach-drip — daily 16:00 UTC (noon ET)
SELECT cron.schedule(
  'dead-lead-outreach-drip-daily',
  '0 16 * * *',
  $$
  SELECT extensions.http_post(
    url:='https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/dead-lead-outreach-drip',
    headers:=jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer '||(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='email_queue_service_role_key' LIMIT 1)
    ),
    body:='{}'::jsonb
  )
  $$
);

-- 7. contractor-fomo-mailer — daily 19:00 UTC (3pm ET)
SELECT cron.schedule(
  'contractor-fomo-mailer-daily',
  '0 19 * * *',
  $$
  SELECT extensions.http_post(
    url:='https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/contractor-fomo-mailer',
    headers:=jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer '||(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='email_queue_service_role_key' LIMIT 1)
    ),
    body:='{}'::jsonb
  )
  $$
);

-- 8. contractor-aged-lead-downsell — daily 18:00 UTC (2pm ET)
SELECT cron.schedule(
  'contractor-aged-lead-downsell-daily',
  '0 18 * * *',
  $$
  SELECT extensions.http_post(
    url:='https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/contractor-aged-lead-downsell',
    headers:=jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer '||(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='email_queue_service_role_key' LIMIT 1)
    ),
    body:='{}'::jsonb
  )
  $$
);

-- 9. dwa-operator — every 4 hours
SELECT cron.schedule(
  'dwa-operator-4h',
  '0 */4 * * *',
  $$
  SELECT extensions.http_post(
    url:='https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/dwa-operator',
    headers:=jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer '||(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='email_queue_service_role_key' LIMIT 1)
    ),
    body:='{}'::jsonb
  )
  $$
);

-- 10. dwa-closer — daily 18:00 UTC (2pm ET)
SELECT cron.schedule(
  'dwa-closer-daily',
  '0 18 * * *',
  $$
  SELECT extensions.http_post(
    url:='https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/dwa-closer',
    headers:=jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer '||(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='email_queue_service_role_key' LIMIT 1)
    ),
    body:='{}'::jsonb
  )
  $$
);
