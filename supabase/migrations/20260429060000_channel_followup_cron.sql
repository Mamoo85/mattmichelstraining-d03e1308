-- channel-prospector-followup: daily 10am ET (14:00 UTC)

DO $migration$
DECLARE
  v_url text := 'https://eauvubfpanpeuxsrqesu.supabase.co';
  v_key text := 'eyJ.REDACTED.JWT';
  v_hdr text;
BEGIN
  IF v_url IS NULL OR v_url = '' THEN RAISE EXCEPTION 'v_url empty'; END IF;
  IF v_key IS NULL OR LENGTH(v_key) < 100 THEN RAISE EXCEPTION 'v_key invalid'; END IF;

  v_hdr := json_build_object('Content-Type','application/json','Authorization','Bearer ' || v_key)::text;

  PERFORM cron.unschedule('channel-prospector-followup-daily')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'channel-prospector-followup-daily');

  PERFORM cron.schedule(
    'channel-prospector-followup-daily',
    '0 14 * * *',
    format($job$SELECT net.http_post(url := %L, headers := %L::jsonb, body := '{}'::jsonb);$job$,
      v_url || '/functions/v1/channel-prospector-followup', v_hdr)
  );
END $migration$;
