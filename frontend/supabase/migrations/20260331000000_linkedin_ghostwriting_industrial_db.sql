-- LinkedIn Ghostwriting + Industrial Database Expansion
-- March 31, 2026

-- LinkedIn Ghostwriting Clients Table
CREATE TABLE IF NOT EXISTS linkedin_ghostwriting_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  industry TEXT,
  topics TEXT,
  tone TEXT DEFAULT 'professional',
  active BOOLEAN DEFAULT FALSE,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  last_post_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE linkedin_ghostwriting_clients ENABLE ROW LEVEL SECURITY;

-- Service role policy (for edge functions)
CREATE POLICY "Service role full access" ON linkedin_ghostwriting_clients
  FOR ALL USING (auth.role() = 'service_role');

-- Index for fast email lookups
CREATE INDEX IF NOT EXISTS idx_linkedin_ghostwriting_email ON linkedin_ghostwriting_clients(email);
CREATE INDEX IF NOT EXISTS idx_linkedin_ghostwriting_active ON linkedin_ghostwriting_clients(active) WHERE active = true;

-- Update b2b_subscribers to allow 'industrial' niche
-- (Already supports this via existing schema, just documenting)
COMMENT ON COLUMN b2b_subscribers.niche IS 'Options: dental, hvac, pt, auto, industrial, field_rep_tools';

-- Create cron job for LinkedIn Ghostwriting (Monday 8am ET = 13:00 UTC)
SELECT
  cron.schedule(
    'linkedin-ghostwriting-weekly',
    '0 13 * * 1', -- Monday 8am ET
    $$
    SELECT
      extensions.http_post(
        url := (SELECT CONCAT(decrypted_secret, '/functions/v1/linkedin-ghostwriter'))
        FROM vault.decrypted_secrets WHERE name = 'supabase_url'),
        headers := jsonb_build_object(
          'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_service_role_key'),
          'Content-Type', 'application/json'
        ),
        body := '{}'::jsonb
      )
    $$
  );

-- Create cron job for Industrial Database Scraper (Weekly on Mondays 10am ET = 15:00 UTC)
SELECT
  cron.schedule(
    'b2b-industrial-scraper-weekly',
    '0 15 * * 1', -- Monday 10am ET
    $$
    SELECT
      extensions.http_post(
        url := (SELECT CONCAT(decrypted_secret, '/functions/v1/b2b-industrial-scraper'))
        FROM vault.decrypted_secrets WHERE name = 'supabase_url'),
        headers := jsonb_build_object(
          'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_service_role_key'),
          'Content-Type', 'application/json'
        ),
        body := '{}'::jsonb
      )
    $$
  );

-- Add webhook handler type for LinkedIn ghostwriting
COMMENT ON COLUMN stripe_webhook_log.metadata_type IS 'Webhook types: contractor_lead_subscription, field_rep_subscription, social_media_subscription, web_design_build, web_design_retainer, b2b_database_subscription, linkedin_ghostwriting_subscription';
