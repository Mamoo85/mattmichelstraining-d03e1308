-- Start the warm-up ramp clock for every active pool
UPDATE public.buyer_universe_targets
SET ramp_day_started = CURRENT_DATE
WHERE ramp_day_started IS NULL;

-- Schedule cold-email-pool-router hourly during business hours ET (Mon-Fri pacing handled in-function later)
DO $migration$
DECLARE
  v_url text := 'https://eauvubfpanpeuxsrqesu.supabase.co';
  v_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVhdXZ1YmZwYW5wZXV4c3JxZXN1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2MzI3MDYsImV4cCI6MjA4OTIwODcwNn0.QF4PaTIhhwBkl0hgh68W4R2CxH22ReokGwJUebI2tKw';
  v_hdr text;
BEGIN
  IF v_url IS NULL OR v_url = '' THEN RAISE EXCEPTION 'v_url empty'; END IF;
  IF v_key IS NULL OR LENGTH(v_key) < 100 THEN RAISE EXCEPTION 'v_key invalid'; END IF;
  v_hdr := json_build_object('Content-Type','application/json','Authorization','Bearer ' || v_key)::text;

  PERFORM cron.unschedule('cold-email-pool-router-hourly')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cold-email-pool-router-hourly');

  PERFORM cron.schedule(
    'cold-email-pool-router-hourly',
    '15 14-22 * * 1-5',  -- :15 of every hour 9am-5pm ET, Mon-Fri
    format($job$SELECT net.http_post(url := %L, headers := %L::jsonb, body := '{}'::jsonb);$job$,
      v_url || '/functions/v1/cold-email-pool-router', v_hdr)
  );
END $migration$;