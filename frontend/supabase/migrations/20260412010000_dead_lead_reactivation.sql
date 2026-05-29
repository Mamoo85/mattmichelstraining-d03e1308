-- Dead Lead Reactivation: tables, contractor column additions
-- White-labeled SMS drip to contractors' old unsold leads — $50 per positive reply

CREATE TABLE IF NOT EXISTS dead_lead_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id uuid NOT NULL,
  name text NOT NULL,
  trade text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','complete')),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE dead_lead_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON dead_lead_campaigns FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX idx_dlc_contractor ON dead_lead_campaigns(contractor_id);

CREATE TABLE IF NOT EXISTS dead_lead_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES dead_lead_campaigns(id) ON DELETE CASCADE,
  contractor_id uuid NOT NULL,
  phone text NOT NULL,
  name text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','drip1_sent','drip2_sent','drip3_sent',
                      'replied_positive','replied_negative','review_requested','opted_out')),
  reply_text text,
  contractor_notified_at timestamptz,
  drip1_sent_at timestamptz,
  drip2_sent_at timestamptz,
  drip3_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE dead_lead_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON dead_lead_contacts FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX idx_dlcontacts_campaign ON dead_lead_contacts(campaign_id);
CREATE INDEX idx_dlcontacts_contractor ON dead_lead_contacts(contractor_id);
CREATE INDEX idx_dlcontacts_status ON dead_lead_contacts(status, created_at DESC);
CREATE INDEX idx_dlcontacts_phone ON dead_lead_contacts(phone);

-- Add google_review_link + roi_token to contractor_clients
ALTER TABLE contractor_clients
  ADD COLUMN IF NOT EXISTS google_review_link text,
  ADD COLUMN IF NOT EXISTS roi_token text DEFAULT gen_random_uuid()::text;

-- Backfill roi_token for any existing rows that got NULL
UPDATE contractor_clients SET roi_token = gen_random_uuid()::text WHERE roi_token IS NULL;

-- pg_cron: dead-lead-drip daily at 10am ET (14:00 UTC)
SELECT cron.schedule(
  'dead-lead-drip',
  '0 14 * * *',
  $$SELECT net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/dead-lead-drip',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.service_role_key')),
    body := '{}'::jsonb
  )$$
);

-- pg_cron: contractor-roi-sms every Friday at 9am ET (13:00 UTC)
SELECT cron.schedule(
  'contractor-roi-sms',
  '0 13 * * 5',
  $$SELECT net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/contractor-roi-sms',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.service_role_key')),
    body := '{}'::jsonb
  )$$
);
