DO $$
DECLARE
  v_verticals text[] := ARRAY['roofing','hvac','plumbing','electrical','pest_control','gutters','exterior','tree','restoration','demo_junk','foundation'];
  v_vertical text;
  v_idx int := 0;
  v_jobname text;
  v_anon text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVhdXZ1YmZwYW5wZXV4c3JxZXN1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2MzI3MDYsImV4cCI6MjA4OTIwODcwNn0.QF4PaTIhhwBkl0hgh68W4R2CxH22ReokGwJUebI2tKw';
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname='trade-radar-scanner-daily') THEN
    PERFORM cron.unschedule('trade-radar-scanner-daily');
  END IF;
  FOREACH v_vertical IN ARRAY v_verticals LOOP
    v_jobname := 'trade-radar-scanner-' || v_vertical;
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname=v_jobname) THEN
      PERFORM cron.unschedule(v_jobname);
    END IF;
    PERFORM cron.schedule(
      v_jobname,
      (v_idx * 2) || ' 12 * * *',
      format($cmd$SELECT net.http_post(url:='https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/trade-radar-scanner',headers:='{"Content-Type":"application/json","Authorization":"Bearer %s"}'::jsonb,body:='{"vertical":"%s"}'::jsonb);$cmd$, v_anon, v_vertical)
    );
    v_idx := v_idx + 1;
  END LOOP;
END $$;