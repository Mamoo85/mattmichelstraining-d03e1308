-- Schedule trojan-horse-upsell to run daily at 10am ET (14:00 UTC)
-- Finds TechAlert clients 30+ days old without FieldDesk and sends cross-sell

SELECT cron.schedule(
  'trojan-horse-upsell-daily',
  '0 14 * * *',  -- 10am ET (14:00 UTC)
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/trojan-horse-upsell',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
