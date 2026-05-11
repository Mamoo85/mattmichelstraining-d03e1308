DO $$ BEGIN PERFORM cron.unschedule('scanner-sources-batch-1-daily'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN PERFORM cron.unschedule('scanner-sources-batch-2-daily'); EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'scanner-sources-batch-1-daily',
  '0 6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/scanner-sources-run-batch-1',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY_VAULT')),
    body := jsonb_build_object('source','cron','ts',now())
  );
  $$
);

SELECT cron.schedule(
  'scanner-sources-batch-2-daily',
  '30 6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/scanner-sources-run-batch-2',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY_VAULT')),
    body := jsonb_build_object('source','cron','ts',now())
  );
  $$
);