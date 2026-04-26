-- pg_cron schedules for all Phase 23 autonomous functions.

-- Unschedule any previous attempts first
DO $$ BEGIN PERFORM cron.unschedule('callback-reminder-sender-5min'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN PERFORM cron.unschedule('site-radar-repeat-alert-hourly'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN PERFORM cron.unschedule('site-radar-weekly-digest-monday'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN PERFORM cron.unschedule('site-radar-health-check-daily'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN PERFORM cron.unschedule('nps-survey-sender-daily'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN PERFORM cron.unschedule('missed-call-escalation-30min'); EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Callback reminders: every 5 minutes
SELECT cron.schedule('callback-reminder-sender-5min', '*/5 * * * *', $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/callback-reminder-sender',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')),
    body := '{}'::jsonb);
$$);

-- Site radar repeat alert: every hour
SELECT cron.schedule('site-radar-repeat-alert-hourly', '0 * * * *', $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/site-radar-repeat-alert',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')),
    body := '{}'::jsonb);
$$);

-- Site radar weekly digest: Monday 11am UTC (7am ET)
SELECT cron.schedule('site-radar-weekly-digest-monday', '0 11 * * 1', $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/site-radar-weekly-digest',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')),
    body := '{}'::jsonb);
$$);

-- Site radar health check: daily 9am UTC
SELECT cron.schedule('site-radar-health-check-daily', '0 9 * * *', $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/site-radar-health-check',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')),
    body := '{}'::jsonb);
$$);

-- NPS survey sender: daily 1pm UTC (9am ET)
SELECT cron.schedule('nps-survey-sender-daily', '0 13 * * *', $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/nps-survey-sender',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')),
    body := '{}'::jsonb);
$$);

-- Missed call escalation: every 30 minutes
SELECT cron.schedule('missed-call-escalation-30min', '*/30 * * * *', $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/missed-call-escalation',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')),
    body := '{}'::jsonb);
$$);
