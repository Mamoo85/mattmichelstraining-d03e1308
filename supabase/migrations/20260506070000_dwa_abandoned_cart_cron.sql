-- Hourly cron: send recovery emails to DWA abandoned checkouts (1h+ old)
select cron.schedule(
  'dwa-abandoned-cart-hourly',
  '0 * * * *',
  $$
  select net.http_post(
    url := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/dwa-abandoned-cart',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets
        where name = 'SUPABASE_SERVICE_ROLE_KEY_VAULT'
      )
    ),
    body := '{}'::jsonb
  );
  $$
);
