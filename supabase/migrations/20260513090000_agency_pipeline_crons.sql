-- Automate the staffing agency buyer pipeline.
-- 1. build-talent-prospect-list: daily 7am ET (11:00 UTC) — fills talent_prospect_list
--    with Apollo-enriched staffing agency contacts across MI/OH/IN/IL.
-- 2. agency-blast-scheduler: daily 9am ET (13:00 UTC) — sends teaser emails to up
--    to 20 uncontacted agencies/day from talent_prospect_list.
DO $migration$
DECLARE
  v_url text := 'https://eauvubfpanpeuxsrqesu.supabase.co';
  v_key text;
BEGIN
  SELECT decrypted_secret INTO v_key
  FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY_VAULT';
  IF v_key IS NULL OR LENGTH(v_key) < 100 THEN RAISE EXCEPTION 'vault key missing'; END IF;

  -- Remove old jobs if they exist
  PERFORM cron.unschedule('build-talent-prospect-list-daily')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'build-talent-prospect-list-daily');
  PERFORM cron.unschedule('agency-blast-scheduler-daily')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'agency-blast-scheduler-daily');

  -- build-talent-prospect-list: 7am ET = 11:00 UTC Mon–Fri
  PERFORM cron.schedule(
    'build-talent-prospect-list-daily',
    '0 11 * * 1-5',
    format(
      $job$SELECT net.http_post(
        url := %L,
        headers := %L::jsonb,
        body := '{}'::jsonb
      );$job$,
      v_url || '/functions/v1/build-talent-prospect-list',
      json_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_key
      )::text
    )
  );

  -- agency-blast-scheduler: 9am ET = 13:00 UTC Mon–Fri
  PERFORM cron.schedule(
    'agency-blast-scheduler-daily',
    '0 13 * * 1-5',
    format(
      $job$SELECT net.http_post(
        url := %L,
        headers := %L::jsonb,
        body := '{}'::jsonb
      );$job$,
      v_url || '/functions/v1/agency-blast-scheduler',
      json_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_key
      )::text
    )
  );
END $migration$;
