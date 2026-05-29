-- Schedule etsy-daily-top-seller-scout at 7:45am UTC daily
-- Finds today's top 5 Etsy sellers, generates near-replicas, queues them.
-- pod-new-products runs 9am-1pm UTC and publishes the queued items same-day.

SELECT cron.unschedule('etsy-daily-top-seller-scout')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'etsy-daily-top-seller-scout');

SELECT cron.schedule(
  'etsy-daily-top-seller-scout',
  '45 7 * * *',
  $job$SELECT net.http_post(
    url := 'https://zmyczlfuufhngzovkjdh.supabase.co/functions/v1/etsy-daily-top-seller-scout',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := '{}'::jsonb
  );$job$
);
