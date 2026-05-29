-- admin-ops-daily-brief cron — daily 8:30 AM ET (12:30 UTC)
-- Sends Matt a cross-product ops email: sends/opens/clicks per product, site radar rollup,
-- queue health, and overnight errors. Fires after all digest functions have run.
DO $migration$
DECLARE
  v_url text := 'https://eauvubfpanpeuxsrqesu.supabase.co';
  v_key text;
BEGIN
  SELECT decrypted_secret INTO v_key
  FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY_VAULT';
  IF v_key IS NULL OR LENGTH(v_key) < 100 THEN RAISE EXCEPTION 'vault key missing'; END IF;

  PERFORM cron.unschedule('admin-ops-daily-brief')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'admin-ops-daily-brief');

  PERFORM cron.schedule(
    'admin-ops-daily-brief',
    '30 12 * * *',
    format(
      $job$SELECT net.http_post(
        url := %L,
        headers := %L::jsonb,
        body := '{}'::jsonb
      );$job$,
      v_url || '/functions/v1/admin-ops-daily-brief',
      json_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_key
      )::text
    )
  );
END $migration$;
