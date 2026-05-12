DO $$
DECLARE
  v_hdr text;
BEGIN
  v_hdr := format('{"Content-Type":"application/json","Authorization":"Bearer %s"}',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVhdXZ1YmZwYW5wZXV4c3JxZXN1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2MzI3MDYsImV4cCI6MjA4OTIwODcwNn0.QF4PaTIhhwBkl0hgh68W4R2CxH22ReokGwJUebI2tKw');

  PERFORM public.safe_cron_schedule(
    'carealert-monthly-report',
    '0 13 1 * *',
    format($job$SELECT net.http_post(url := %L, headers := %L::jsonb, body := '{}'::jsonb);$job$,
      'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/carealert-monthly-report', v_hdr)
  );
END $$;