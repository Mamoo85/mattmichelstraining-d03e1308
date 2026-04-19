DO $$
DECLARE
  v_url text;
  v_key text;
BEGIN
  BEGIN
    SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL_VAULT';
    SELECT decrypted_secret INTO v_key FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY_VAULT';
  EXCEPTION WHEN OTHERS THEN
    v_url := NULL;
  END;
  IF v_url IS NULL THEN v_url := 'https://eauvubfpanpeuxsrqesu.supabase.co'; END IF;

  -- Drop existing schedule if present
  PERFORM cron.unschedule(jobname) FROM cron.job WHERE jobname = 'llm-cache-monitor-hourly';

  PERFORM cron.schedule(
    'llm-cache-monitor-hourly',
    '17 * * * *',
    format(
      $cron$
      SELECT net.http_post(
        url := %L,
        headers := %L::jsonb,
        body := '{}'::jsonb
      );
      $cron$,
      v_url || '/functions/v1/llm-cache-monitor',
      CASE WHEN v_key IS NOT NULL
        THEN jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||v_key)::text
        ELSE jsonb_build_object('Content-Type','application/json')::text
      END
    )
  );
END$$;