-- dead-lead-outreach-drip: daily noon ET (16:00 UTC)
SELECT cron.schedule(
  'dead-lead-outreach-drip',
  '0 16 * * *',
  $$SELECT net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/dead-lead-outreach-drip',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.service_role_key')),
    body := '{}'::jsonb
  )$$
);

-- dead-lead-daily-notifier: daily 5pm ET (21:00 UTC)
SELECT cron.schedule(
  'dead-lead-daily-notifier',
  '0 21 * * *',
  $$SELECT net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/dead-lead-daily-notifier',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.service_role_key')),
    body := '{}'::jsonb
  )$$
);
