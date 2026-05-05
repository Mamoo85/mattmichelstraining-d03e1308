-- Business Improvements Batch 1
-- Adds columns for Trade Radar outreach tracking and wires new cron jobs.

-- 1. outreach_sent_at on trade_radar_leads (Trade Radar cold email pipeline)
ALTER TABLE trade_radar_leads ADD COLUMN IF NOT EXISTS outreach_sent_at TIMESTAMPTZ;
ALTER TABLE trade_radar_leads ADD COLUMN IF NOT EXISTS outreach_email TEXT;

-- 2. source column on outreach_leads (SiteRadar → outreach pipeline)
ALTER TABLE outreach_leads ADD COLUMN IF NOT EXISTS source TEXT;

-- 3. Cron: trade-radar-outreach daily at 11am ET (15:00 UTC)
SELECT cron.schedule(
  'trade-radar-outreach-daily',
  '0 15 * * *',
  $$
  SELECT net.http_post(
    url := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/trade-radar-outreach',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY_VAULT')),
    body := '{}'::jsonb
  )
  $$
);

-- 4. Cron: trade-radar-urgency-alert daily at 5pm ET (21:00 UTC)
SELECT cron.schedule(
  'trade-radar-urgency-alert-daily',
  '0 21 * * *',
  $$
  SELECT net.http_post(
    url := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/trade-radar-urgency-alert',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY_VAULT')),
    body := '{}'::jsonb
  )
  $$
);

-- 5. Cron: data-retention-cleanup weekly on Sunday at 2am UTC
SELECT cron.schedule(
  'data-retention-cleanup-weekly',
  '0 2 * * 0',
  $$
  SELECT net.http_post(
    url := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/data-retention-cleanup',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY_VAULT')),
    body := '{}'::jsonb
  )
  $$
);

-- 6. Cron: email-deliverability-check weekly on Monday at 7am ET (11:00 UTC)
SELECT cron.schedule(
  'email-deliverability-check-weekly',
  '0 11 * * 1',
  $$
  SELECT net.http_post(
    url := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/email-deliverability-check',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY_VAULT')),
    body := '{}'::jsonb
  )
  $$
);

-- 7. global_outreach_log table for cross-product deduplication
CREATE TABLE IF NOT EXISTS global_outreach_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  domain TEXT NOT NULL,
  email TEXT,
  product TEXT NOT NULL,
  campaign TEXT,
  contacted_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_global_outreach_log_domain_contacted ON global_outreach_log (domain, contacted_at DESC);

ALTER TABLE global_outreach_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON global_outreach_log USING (true) WITH CHECK (true);
