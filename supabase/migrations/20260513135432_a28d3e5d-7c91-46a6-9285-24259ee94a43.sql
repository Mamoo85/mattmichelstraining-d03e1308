DO $$
DECLARE
  v_url text := 'https://eauvubfpanpeuxsrqesu.supabase.co';
  v_key text;
BEGIN
  SELECT decrypted_secret INTO v_key
  FROM vault.decrypted_secrets
  WHERE name = 'SUPABASE_SERVICE_ROLE_KEY_VAULT'
  LIMIT 1;

  PERFORM cron.unschedule('agency-blast-scheduler-daily');
  PERFORM cron.schedule(
    'agency-blast-scheduler-daily',
    '0 14 * * 1-5',
    format(
      $f$SELECT net.http_post(
        url := %L,
        headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer %s'),
        body := '{}'::jsonb
      )$f$,
      v_url || '/functions/v1/agency-blast-scheduler', v_key
    )
  );
EXCEPTION WHEN OTHERS THEN
  -- unschedule fails if job didn't exist; schedule it fresh
  PERFORM cron.schedule(
    'agency-blast-scheduler-daily',
    '0 14 * * 1-5',
    format(
      $f$SELECT net.http_post(
        url := %L,
        headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer %s'),
        body := '{}'::jsonb
      )$f$,
      v_url || '/functions/v1/agency-blast-scheduler', v_key
    )
  );
END $$;