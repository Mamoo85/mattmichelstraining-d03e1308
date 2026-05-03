SELECT cron.schedule(
  'cold-email-daily-economics',
  '0 0 * * *',
  $$select net.http_post(
    url:='https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/cold-email-daily-economics',
    headers:='{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVhdXZ1YmZwYW5wZXV4c3JxZXN1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2MzI3MDYsImV4cCI6MjA4OTIwODcwNn0.QF4PaTIhhwBkl0hgh68W4R2CxH22ReokGwJUebI2tKw"}'::jsonb,
    body:='{}'::jsonb
  );$$
);