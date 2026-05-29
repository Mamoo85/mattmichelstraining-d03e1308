DO $migration$
DECLARE
  v_url text := 'https://eauvubfpanpeuxsrqesu.supabase.co';
  v_key text := 'eyJ.REDACTED.JWT';
  v_hdr text;
BEGIN
  IF v_url IS NULL OR v_url = '' THEN RAISE EXCEPTION 'v_url empty'; END IF;
  IF v_key IS NULL OR LENGTH(v_key) < 100 THEN RAISE EXCEPTION 'v_key invalid'; END IF;
  v_hdr := json_build_object('Content-Type','application/json','Authorization','Bearer ' || v_key)::text;

  -- Retry safety nets for daily jobs that have been missing fires due to
  -- pg_cron worker-pool exhaustion. Each retry runs ~5 minutes after the
  -- primary; the target functions are idempotent (skip if already ran today).

  PERFORM cron.unschedule('mortgage-radar-scanner-retry') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'mortgage-radar-scanner-retry');
  PERFORM cron.schedule('mortgage-radar-scanner-retry', '5 11 * * *',
    format($job$SELECT net.http_post(url := %L, headers := %L::jsonb, body := '{}'::jsonb);$job$,
      v_url || '/functions/v1/mortgage-radar-scanner', v_hdr));

  PERFORM cron.unschedule('mortgage-radar-am-digest-retry') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'mortgage-radar-am-digest-retry');
  PERFORM cron.schedule('mortgage-radar-am-digest-retry', '35 11 * * *',
    format($job$SELECT net.http_post(url := %L, headers := %L::jsonb, body := '{}'::jsonb);$job$,
      v_url || '/functions/v1/mortgage-radar-am-digest', v_hdr));

  PERFORM cron.unschedule('trade-radar-am-digest-retry') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'trade-radar-am-digest-retry');
  PERFORM cron.schedule('trade-radar-am-digest-retry', '5 13 * * *',
    format($job$SELECT net.http_post(url := %L, headers := %L::jsonb, body := '{}'::jsonb);$job$,
      v_url || '/functions/v1/trade-radar-am-digest', v_hdr));
END $migration$;