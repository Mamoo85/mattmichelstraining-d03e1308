DO $$
DECLARE service_key text;
BEGIN
  SELECT decrypted_secret INTO service_key FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY_VAULT' LIMIT 1;

  PERFORM cron.unschedule('etsy-product-sync-hourly') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='etsy-product-sync-hourly');
  PERFORM cron.unschedule('etsy-product-sync-6h') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='etsy-product-sync-6h');

  PERFORM cron.schedule(
    'etsy-product-sync-6h',
    '7 */6 * * *',
    format($cmd$
      SELECT net.http_post(
        url := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/etsy-product-sync',
        headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer %s'),
        body := '{}'::jsonb
      );
    $cmd$, service_key)
  );
END $$;