-- site-radar-am-digest cron — daily 7:30 AM ET (11:30 UTC)
-- Sends premium dark-theme daily visitor intelligence email to every active SiteRadar client.
-- Runs alongside the weekly digest (Monday 7am); daily replaces the weekly's job
-- for day-to-day visibility while weekly remains as a Sunday summary.
DO $migration$
DECLARE
  v_url text := 'https://eauvubfpanpeuxsrqesu.supabase.co';
  v_key text;
BEGIN
  SELECT decrypted_secret INTO v_key
  FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY_VAULT';
  IF v_key IS NULL OR LENGTH(v_key) < 100 THEN RAISE EXCEPTION 'vault key missing'; END IF;

  PERFORM cron.unschedule('site-radar-am-digest-daily')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'site-radar-am-digest-daily');

  PERFORM cron.schedule(
    'site-radar-am-digest-daily',
    '30 11 * * *',
    format(
      $job$SELECT net.http_post(
        url := %L,
        headers := %L::jsonb,
        body := '{}'::jsonb
      );$job$,
      v_url || '/functions/v1/site-radar-am-digest',
      json_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_key
      )::text
    )
  );
END $migration$;
