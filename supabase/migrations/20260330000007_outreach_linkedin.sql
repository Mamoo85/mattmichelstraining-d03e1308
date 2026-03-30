ALTER TABLE outreach_leads ADD COLUMN IF NOT EXISTS linkedin_message TEXT;
ALTER TABLE outreach_leads ADD COLUMN IF NOT EXISTS linkedin_sent_at TIMESTAMPTZ;
ALTER TABLE outreach_leads ADD COLUMN IF NOT EXISTS channel TEXT DEFAULT 'email';
