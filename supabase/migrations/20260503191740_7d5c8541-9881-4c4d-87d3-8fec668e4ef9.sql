
DO $$
DECLARE
  v_hdr text := format('{"Content-Type":"application/json","Authorization":"Bearer %s"}',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVhdXZ1YmZwYW5wZXV4c3JxZXN1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2MzI3MDYsImV4cCI6MjA4OTIwODcwNn0.QF4PaTIhhwBkl0hgh68W4R2CxH22ReokGwJUebI2tKw');
BEGIN
  PERFORM public.safe_cron_schedule(
    'enrichment-kpi-monitor',
    '*/30 16-1 * * *',  -- every 30 min, 16:00–01:30 UTC ≈ 11 AM–8:30 PM ET
    format($job$SELECT net.http_post(url := %L, headers := %L::jsonb, body := '{}'::jsonb);$job$,
      'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/enrichment-kpi-monitor',
      v_hdr)
  );
END $$;
