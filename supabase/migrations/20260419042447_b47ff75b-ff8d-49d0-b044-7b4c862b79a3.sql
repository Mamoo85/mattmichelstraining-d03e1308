DO $$
DECLARE
  v_url text := 'https://eauvubfpanpeuxsrqesu.supabase.co';
  v_key text;
BEGIN
  BEGIN
    SELECT decrypted_secret INTO v_key FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY_VAULT';
  EXCEPTION WHEN OTHERS THEN v_key := NULL;
  END;

  PERFORM cron.unschedule(jobname) FROM cron.job WHERE jobname = 'queue-worker-enrich-stage-1m';

  PERFORM cron.schedule(
    'queue-worker-enrich-stage-1m',
    '* * * * *',
    format(
      $cron$
      SELECT net.http_post(
        url := %L,
        headers := %L::jsonb,
        body := '{}'::jsonb
      );
      $cron$,
      v_url || '/functions/v1/queue-worker-enrich-stage',
      CASE WHEN v_key IS NOT NULL
        THEN jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||v_key)::text
        ELSE jsonb_build_object('Content-Type','application/json')::text
      END
    )
  );
END$$;