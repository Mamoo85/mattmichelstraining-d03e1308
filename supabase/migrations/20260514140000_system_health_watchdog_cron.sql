-- system-health-watchdog cron — daily 6:00 AM ET (10:00 UTC)
-- Runs before the morning digests. If any product had 2+ errors overnight,
-- sends Matt a consolidated SMS alert so he can investigate before digests fire.
DO $migration$
DECLARE
  v_url text := 'https://eauvubfpanpeuxsrqesu.supabase.co';
  v_key text;
BEGIN
  SELECT decrypted_secret INTO v_key
  FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY_VAULT';
  IF v_key IS NULL OR LENGTH(v_key) < 100 THEN RAISE EXCEPTION 'vault key missing'; END IF;

  PERFORM cron.unschedule('system-health-watchdog')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'system-health-watchdog');

  PERFORM cron.schedule(
    'system-health-watchdog',
    '0 10 * * *',
    format(
      $job$SELECT net.http_post(
        url := %L,
        headers := %L::jsonb,
        body := '{}'::jsonb
      );$job$,
      v_url || '/functions/v1/system-health-watchdog',
      json_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_key
      )::text
    )
  );
END $migration$;
