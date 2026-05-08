SELECT cron.schedule(
  'techalert-teaser-blast-quota-reset',
  '5 0 * * *',
  $$
  SELECT net.http_post(
    url := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/techalert-trial-teaser-blast',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY_VAULT')
    ),
    body := jsonb_build_object('limit', 50, 'dry_run', false)
  );
  $$
);