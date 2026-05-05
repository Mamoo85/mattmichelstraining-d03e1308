-- Monthly proof-of-work email crons for FieldDesk, SiteRadar, Missed-Call
-- Fires on the 1st of each month at 10am ET (14:00 UTC)

select cron.schedule(
  'field-crm-monthly-proof',
  '0 14 1 * *',
  $$
  select net.http_post(
    url := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/field-crm-monthly-proof',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'SUPABASE_SERVICE_ROLE_KEY_VAULT')
    ),
    body := '{}'::jsonb
  );
  $$
);

select cron.schedule(
  'site-radar-monthly-proof',
  '0 14 1 * *',
  $$
  select net.http_post(
    url := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/site-radar-monthly-proof',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'SUPABASE_SERVICE_ROLE_KEY_VAULT')
    ),
    body := '{}'::jsonb
  );
  $$
);

select cron.schedule(
  'missed-call-monthly-proof',
  '0 14 1 * *',
  $$
  select net.http_post(
    url := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/missed-call-monthly-proof',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'SUPABASE_SERVICE_ROLE_KEY_VAULT')
    ),
    body := '{}'::jsonb
  );
  $$
);
