-- Schedule orphan background workers shipped in last 48h.
-- Idempotent: unschedule first if exists, then schedule.

DO $$
DECLARE
  jobs text[][] := ARRAY[
    -- [jobname, cron_expr, function_name]
    ARRAY['cron-health-monitor-15m','*/15 * * * *','cron-health-monitor'],
    ARRAY['outreach-queue-worker-2m','*/2 * * * *','outreach-queue-worker'],
    ARRAY['outreach-backlog-watchdog-30m','*/30 * * * *','outreach-backlog-watchdog'],
    ARRAY['intent-score-recompute-hourly','0 * * * *','intent-score-recompute'],
    ARRAY['compute-intent-score-10m','*/10 * * * *','compute-intent-score'],
    ARRAY['geocode-signals-batch-15m','*/15 * * * *','geocode-signals-batch'],
    ARRAY['hiring-velocity-tracker-daily','0 12 * * *','hiring-velocity-tracker']
  ];
  j text[];
BEGIN
  FOREACH j SLICE 1 IN ARRAY jobs LOOP
    PERFORM cron.unschedule(j[1]) WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = j[1]);
    PERFORM cron.schedule(
      j[1],
      j[2],
      format(
        $cmd$SELECT net.http_post(
          url := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/%s',
          headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVhdXZ1YmZwYW5wZXV4c3JxZXN1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2MzI3MDYsImV4cCI6MjA4OTIwODcwNn0.QF4PaTIhhwBkl0hgh68W4R2CxH22ReokGwJUebI2tKw"}'::jsonb,
          body := '{}'::jsonb
        );$cmd$,
        j[3]
      )
    );
  END LOOP;
END $$;