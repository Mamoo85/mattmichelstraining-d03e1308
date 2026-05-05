-- Schedule the unified DWA product blast: every weekday at 11am ET (15:00 UTC)
DO $migration$
DECLARE
  v_url text := 'https://eauvubfpanpeuxsrqesu.supabase.co';
  v_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVhdXZ1YmZwYW5wZXV4c3JxZXN1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2MzI3MDYsImV4cCI6MjA4OTIwODcwNn0.QF4PaTIhhwBkl0hgh68W4R2CxH22ReokGwJUebI2tKw';
  v_hdr text;
BEGIN
  IF v_url IS NULL OR v_url = '' THEN RAISE EXCEPTION 'v_url empty'; END IF;
  IF v_key IS NULL OR LENGTH(v_key) < 100 THEN RAISE EXCEPTION 'v_key invalid'; END IF;
  v_hdr := json_build_object('Content-Type','application/json','Authorization','Bearer ' || v_key)::text;

  PERFORM cron.unschedule('dwa-product-blast-daily') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'dwa-product-blast-daily');
  PERFORM cron.schedule('dwa-product-blast-daily', '0 15 * * 1-5',
    format($job$SELECT net.http_post(url := %L, headers := %L::jsonb, body := '{}'::jsonb);$job$,
      v_url || '/functions/v1/dwa-product-blast', v_hdr));

  PERFORM cron.unschedule('dwa-product-blast-afternoon') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'dwa-product-blast-afternoon');
  PERFORM cron.schedule('dwa-product-blast-afternoon', '0 19 * * 1-5',
    format($job$SELECT net.http_post(url := %L, headers := %L::jsonb, body := '{}'::jsonb);$job$,
      v_url || '/functions/v1/dwa-product-blast', v_hdr));
END $migration$;