DO $migration$
DECLARE
  v_url text := 'https://eauvubfpanpeuxsrqesu.supabase.co';
  v_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVhdXZ1YmZwYW5wZXV4c3JxZXN1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2MzI3MDYsImV4cCI6MjA4OTIwODcwNn0.QF4PaTIhhwBkl0hgh68W4R2CxH22ReokGwJUebI2tKw';
  v_hdr text;
  v_jobs text[]      := ARRAY['cron-sentinel-6h','industry-pulse-scanner-daily','lead-quality-scorer-daily','medicare-staffing-intel-daily','permit-watch-scanner-daily','license-expiry-checker-daily'];
  v_schedules text[] := ARRAY['0 */6 * * *','0 10 * * *','30 11 * * *','0 9 * * *','0 13 * * *','0 8 * * *'];
  v_endpoints text[] := ARRAY['cron-sentinel','industry-pulse-scanner','lead-quality-scorer','medicare-staffing-intel','permit-watch-scanner','license-expiry-checker'];
  v_bodies text[]    := ARRAY['{"trigger":"cron"}','{}','{}','{}','{}','{}'];
  i int;
BEGIN
  IF v_url IS NULL OR v_url = '' THEN RAISE EXCEPTION 'v_url empty'; END IF;
  IF v_key IS NULL OR LENGTH(v_key) < 100 THEN RAISE EXCEPTION 'v_key invalid'; END IF;

  v_hdr := json_build_object('Content-Type','application/json','Authorization','Bearer ' || v_key)::text;

  FOR i IN 1 .. array_length(v_jobs,1) LOOP
    PERFORM cron.unschedule(v_jobs[i]) WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = v_jobs[i]);
    PERFORM cron.schedule(
      v_jobs[i],
      v_schedules[i],
      format(
        $job$SELECT net.http_post(url := %L, headers := %L::jsonb, body := %L::jsonb);$job$,
        v_url || '/functions/v1/' || v_endpoints[i],
        v_hdr,
        v_bodies[i]
      )
    );
  END LOOP;

  RAISE NOTICE 'Scheduled % missing critical crons.', array_length(v_jobs,1);
END $migration$;