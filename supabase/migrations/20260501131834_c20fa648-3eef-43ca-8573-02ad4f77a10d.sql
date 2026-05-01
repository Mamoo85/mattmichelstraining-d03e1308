DO $$
DECLARE
  v_url TEXT;
  v_key TEXT;
BEGIN
  SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets WHERE name = 'project_url' LIMIT 1;
  SELECT decrypted_secret INTO v_key FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1;

  IF v_url IS NULL THEN v_url := 'https://eauvubfpanpeuxsrqesu.supabase.co'; END IF;

  -- Unschedule if exists (idempotent)
  PERFORM cron.unschedule('dwa-v4-retention-sweep-daily')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'dwa-v4-retention-sweep-daily');

  PERFORM cron.schedule(
    'dwa-v4-retention-sweep-daily',
    '0 15 * * *',
    format($cmd$
      SELECT net.http_post(
        url := %L,
        headers := %L::jsonb,
        body := '{}'::jsonb
      );
    $cmd$,
      v_url || '/functions/v1/dwa-v4-retention-sweep',
      jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || COALESCE(v_key,''))::text
    )
  );
END $$;