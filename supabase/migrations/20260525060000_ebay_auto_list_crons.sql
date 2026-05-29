-- eBay automation crons
-- Accelerate pod-new-products to every 10 minutes (from 5x/day)
-- Add auto-list cron: list newly published products on eBay every hour

-- 1. Remove old 9am-1pm hourly schedule for pod-new-products
SELECT cron.unschedule('pod-new-products-9am')  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'pod-new-products-9am');
SELECT cron.unschedule('pod-new-products-10am') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'pod-new-products-10am');
SELECT cron.unschedule('pod-new-products-11am') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'pod-new-products-11am');
SELECT cron.unschedule('pod-new-products-12pm') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'pod-new-products-12pm');
SELECT cron.unschedule('pod-new-products-1pm')  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'pod-new-products-1pm');
-- Also remove any generic name
SELECT cron.unschedule('pod-new-products') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'pod-new-products');

-- 2. pod-new-products every 10 minutes, 8am–8pm UTC (aggressive catch-up)
SELECT cron.schedule(
  'pod-new-products-10min',
  '*/10 8-20 * * *',
  $$
  SELECT net.http_post(
    url := 'https://zmyczlfuufhngzovkjdh.supabase.co/functions/v1/pod-new-products',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer ' ||
      (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY_VAULT') ||
      '"}'::jsonb,
    body := '{"mode":"process"}'::jsonb
  );
  $$
);

-- 3. ebay-lister physical mode every hour (auto-list newly published products)
SELECT cron.unschedule('ebay-auto-list-hourly') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ebay-auto-list-hourly');

SELECT cron.schedule(
  'ebay-auto-list-hourly',
  '30 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://zmyczlfuufhngzovkjdh.supabase.co/functions/v1/ebay-lister',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer ' ||
      (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY_VAULT') ||
      '"}'::jsonb,
    body := '{"mode":"physical","limit":20}'::jsonb
  );
  $$
);
