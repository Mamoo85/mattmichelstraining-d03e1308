-- Schedule 9 autonomous agent crons that exist on disk but have no pg_cron rows.
-- Uses vault.decrypted_secrets pattern — current_setting() returns NULL in cron context.

DO $$ BEGIN
  PERFORM cron.unschedule('oz-autonomous-15min');       EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$ BEGIN
  PERFORM cron.unschedule('selma-autonomous-daily');    EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$ BEGIN
  PERFORM cron.unschedule('scarlett-autonomous-daily'); EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$ BEGIN
  PERFORM cron.unschedule('ops-autonomous-daily');      EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$ BEGIN
  PERFORM cron.unschedule('scout-competitor-weekly');   EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$ BEGIN
  PERFORM cron.unschedule('hype-social-proof-weekly'); EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$ BEGIN
  PERFORM cron.unschedule('drill-content-daily');       EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$ BEGIN
  PERFORM cron.unschedule('pulse-sms-4hr');             EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$ BEGIN
  PERFORM cron.unschedule('ref-referral-weekly');       EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- oz-autonomous: every 15 minutes (admin overseer)
SELECT cron.schedule('oz-autonomous-15min', '*/15 * * * *', $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/oz-autonomous',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')
    ),
    body := '{}'::jsonb
  );
$$);

-- selma-autonomous: daily 9am ET (13:00 UTC)
SELECT cron.schedule('selma-autonomous-daily', '0 13 * * *', $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/selma-autonomous',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')
    ),
    body := '{}'::jsonb
  );
$$);

-- scarlett-autonomous: daily 2pm ET (18:00 UTC)
SELECT cron.schedule('scarlett-autonomous-daily', '0 18 * * *', $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/scarlett-autonomous',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')
    ),
    body := '{}'::jsonb
  );
$$);

-- ops-autonomous: daily 9am ET (13:00 UTC)
SELECT cron.schedule('ops-autonomous-daily', '0 13 * * *', $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/ops-autonomous',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')
    ),
    body := '{}'::jsonb
  );
$$);

-- scout-competitor-watch: Monday 10am ET (14:00 UTC)
SELECT cron.schedule('scout-competitor-weekly', '0 14 * * 1', $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/scout-competitor-watch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')
    ),
    body := '{}'::jsonb
  );
$$);

-- hype-social-proof: Wednesday 10am ET (14:00 UTC)
SELECT cron.schedule('hype-social-proof-weekly', '0 14 * * 3', $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/hype-social-proof',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')
    ),
    body := '{}'::jsonb
  );
$$);

-- drill-content-monitor: daily 11am ET (15:00 UTC)
SELECT cron.schedule('drill-content-daily', '0 15 * * *', $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/drill-content-monitor',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')
    ),
    body := '{}'::jsonb
  );
$$);

-- pulse-sms-monitor: every 4 hours
SELECT cron.schedule('pulse-sms-4hr', '0 */4 * * *', $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/pulse-sms-monitor',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')
    ),
    body := '{}'::jsonb
  );
$$);

-- ref-referral-optimizer: Friday 9am ET (13:00 UTC)
SELECT cron.schedule('ref-referral-weekly', '0 13 * * 5', $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/ref-referral-optimizer',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')
    ),
    body := '{}'::jsonb
  );
$$);
