DO $$
DECLARE service_key text;
BEGIN
  SELECT decrypted_secret INTO service_key FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY_VAULT' LIMIT 1;

  PERFORM cron.unschedule('etsy-listing-rewriter-weekly') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='etsy-listing-rewriter-weekly');

  PERFORM cron.schedule('etsy-listing-rewriter-weekly', '0 14 * * 2', format($cmd$
    SELECT net.http_post(
      url := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/etsy-listing-rewriter',
      headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer %s'),
      body := '{"limit":5}'::jsonb
    );
  $cmd$, service_key));
END $$;