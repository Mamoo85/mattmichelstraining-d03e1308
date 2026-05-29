-- Add automation tracking columns to outreach_leads
ALTER TABLE public.outreach_leads
  ADD COLUMN IF NOT EXISTS offer_pitched TEXT,
  ADD COLUMN IF NOT EXISTS sms_sent BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sms_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sms_2_sent BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sms_2_sent_at TIMESTAMPTZ;

-- Cron: contractor-prospector daily 11am ET (15:00 UTC)
SELECT cron.schedule(
  'contractor-prospector-daily',
  '0 15 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/contractor-prospector',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')
    ),
    body := '{}'::jsonb
  )
  $$
);

-- Cron: contractor-drip daily 12pm ET (16:00 UTC)
SELECT cron.schedule(
  'contractor-drip-daily',
  '0 16 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/contractor-drip',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')
    ),
    body := '{}'::jsonb
  )
  $$
);

-- Cron: contractor-sms-follow daily 2pm ET (18:00 UTC)
SELECT cron.schedule(
  'contractor-sms-daily',
  '0 18 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/contractor-sms-follow',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')
    ),
    body := '{}'::jsonb
  )
  $$
);
