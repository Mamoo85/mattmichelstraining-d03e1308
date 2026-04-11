-- Bounty 3: TechAlert 72h Trial + 96h Phantom Alert

-- Add trial columns to hire_alert_clients
ALTER TABLE hire_alert_clients ADD COLUMN IF NOT EXISTS trial_started_at timestamptz;
ALTER TABLE hire_alert_clients ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz;
ALTER TABLE hire_alert_clients ADD COLUMN IF NOT EXISTS trial_status text DEFAULT 'none';
-- trial_status: 'none' | 'active' | 'expired' | 'phantom_sent' | 'converted'

-- Hourly cron: check for trial conversions (72h expiry)
SELECT cron.schedule(
  'hire-alert-trial-convert',
  '0 * * * *',
  $$
    SELECT net.http_post(
      url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1) || '/functions/v1/hire-alert-trial-convert',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1)
      ),
      body := '{}'::jsonb
    );
  $$
);

-- Daily cron at 8:30am ET (1:30pm UTC): phantom alert
SELECT cron.schedule(
  'hire-alert-phantom-alert',
  '30 13 * * *',
  $$
    SELECT net.http_post(
      url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1) || '/functions/v1/hire-alert-phantom-alert',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1)
      ),
      body := '{}'::jsonb
    );
  $$
);
