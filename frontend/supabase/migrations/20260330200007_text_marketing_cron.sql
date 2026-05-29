-- Monthly text marketing campaign cron — 1st of each month at 10am ET
SELECT cron.schedule(
  'text-marketing-monthly',
  '0 15 1 * *',
  $$
  SELECT net.http_post(
    url := 'https://zmyczlfuufhngzovkjdh.supabase.co/functions/v1/text-marketing-sender',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.service_role_key', true) || '"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
