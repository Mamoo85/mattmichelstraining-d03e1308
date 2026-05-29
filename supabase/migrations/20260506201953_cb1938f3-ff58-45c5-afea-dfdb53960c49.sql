DO $migration$
DECLARE
  v_url text := 'https://eauvubfpanpeuxsrqesu.supabase.co';
  v_key text := 'eyJ.REDACTED.JWT';
  v_hdr text;
BEGIN
  IF v_url IS NULL OR v_url = '' THEN RAISE EXCEPTION 'v_url empty'; END IF;
  IF v_key IS NULL OR LENGTH(v_key) < 100 THEN RAISE EXCEPTION 'v_key invalid'; END IF;
  v_hdr := json_build_object('Content-Type','application/json','Authorization','Bearer ' || v_key)::text;

  PERFORM public.safe_cron_schedule(
    'demo-reminder-dispatcher-15m',
    '*/15 * * * *',
    format($job$SELECT net.http_post(url := %L, headers := %L::jsonb, body := '{}'::jsonb);$job$,
      v_url || '/functions/v1/demo-reminder-dispatcher', v_hdr)
  );
END $migration$;