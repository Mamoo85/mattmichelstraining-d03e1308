DO $migration$
DECLARE
  v_url text := 'https://eauvubfpanpeuxsrqesu.supabase.co';
  v_key text := 'eyJ.REDACTED.JWT';
  v_hdr text;
BEGIN
  IF v_url IS NULL OR v_url = '' THEN RAISE EXCEPTION 'v_url empty'; END IF;
  IF v_key IS NULL OR LENGTH(v_key) < 100 THEN RAISE EXCEPTION 'v_key invalid'; END IF;

  v_hdr := json_build_object('Content-Type','application/json','Authorization','Bearer ' || v_key)::text;

  PERFORM cron.unschedule('techalert-prospect-hunter-daily')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'techalert-prospect-hunter-daily');

  PERFORM cron.schedule(
    'techalert-prospect-hunter-daily',
    '0 10 * * *',
    format($job$SELECT net.http_post(url := %L, headers := %L::jsonb, body := '{"trigger":"cron"}'::jsonb);$job$,
      v_url || '/functions/v1/techalert-prospect-hunter', v_hdr)
  );
END $migration$;