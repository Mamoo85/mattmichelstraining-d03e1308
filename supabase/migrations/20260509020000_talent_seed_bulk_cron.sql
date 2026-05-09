-- Nightly talent-seed-bulk cron — cycles through all 50 states over 5 days
-- Each run covers today's 10-state window (state selection is date-based inside the function)
DO $migration$
DECLARE
  v_url text := 'https://eauvubfpanpeuxsrqesu.supabase.co';
  v_key text;
BEGIN
  SELECT decrypted_secret INTO v_key
  FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY_VAULT';
  IF v_key IS NULL OR LENGTH(v_key) < 100 THEN RAISE EXCEPTION 'vault key missing'; END IF;

  PERFORM cron.unschedule('talent-seed-bulk-nightly')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'talent-seed-bulk-nightly');

  PERFORM cron.schedule(
    'talent-seed-bulk-nightly',
    '30 2 * * *',  -- 2:30am UTC = 10:30pm EDT — low traffic window
    format(
      $job$SELECT net.http_post(
        url := %L,
        headers := %L::jsonb,
        body := '{"limit_per_state":200}'::jsonb
      );$job$,
      v_url || '/functions/v1/talent-seed-bulk',
      json_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_key
      )::text
    )
  );
END $migration$;
