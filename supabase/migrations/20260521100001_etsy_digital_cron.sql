-- Schedule etsy-digital-uploader at 2pm UTC daily
-- Creates 3 printable wall art listings per run (3-pack at $4.99 each)

SELECT cron.unschedule('etsy-digital-uploader') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'etsy-digital-uploader');
SELECT cron.schedule(
  'etsy-digital-uploader',
  '0 14 * * *',
  $job$SELECT net.http_post(
    url := 'https://zmyczlfuufhngzovkjdh.supabase.co/functions/v1/etsy-digital-uploader',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := '{}'::jsonb
  );$job$
);
