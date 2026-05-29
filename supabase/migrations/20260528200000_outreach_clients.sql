-- outreach_clients: multi-tenant SDR clients who purchase the autonomous outreach product
CREATE TABLE IF NOT EXISTS outreach_clients (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name           text NOT NULL,
  contact_name           text,
  contact_email          text,
  target_industry        text NOT NULL DEFAULT 'hvac',
  target_geography       text NOT NULL DEFAULT 'Metro Detroit',
  daily_email_cap        int  NOT NULL DEFAULT 50,
  pitch_headline         text,
  pitch_body             text,
  cta_url                text,
  stripe_customer_id     text,
  stripe_subscription_id text,
  status                 text NOT NULL DEFAULT 'trial' CHECK (status IN ('trial','active','paused','cancelled')),
  trial_ends_at          timestamptz,
  notes                  text,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

-- outreach_campaign_stats: daily per-client funnel metrics
CREATE TABLE IF NOT EXISTS outreach_campaign_stats (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id         uuid NOT NULL REFERENCES outreach_clients(id) ON DELETE CASCADE,
  date              date NOT NULL DEFAULT CURRENT_DATE,
  prospects_found   int  NOT NULL DEFAULT 0,
  enriched          int  NOT NULL DEFAULT 0,
  emails_sent       int  NOT NULL DEFAULT 0,
  emails_opened     int  NOT NULL DEFAULT 0,
  replies           int  NOT NULL DEFAULT 0,
  meetings_booked   int  NOT NULL DEFAULT 0,
  UNIQUE (client_id, date)
);

-- Add client_id to prospect targets so we can track per-client prospects
ALTER TABLE techalert_prospect_targets
  ADD COLUMN IF NOT EXISTS outreach_client_id uuid REFERENCES outreach_clients(id);

-- Index for fast per-client queries
CREATE INDEX IF NOT EXISTS idx_techalert_targets_client ON techalert_prospect_targets(outreach_client_id);
CREATE INDEX IF NOT EXISTS idx_outreach_stats_client_date ON outreach_campaign_stats(client_id, date DESC);

-- Enroll Matt Michels as first client (DWA internal — testing + dogfood)
INSERT INTO outreach_clients (
  company_name, contact_name, contact_email,
  target_industry, target_geography,
  daily_email_cap,
  pitch_headline,
  pitch_body,
  cta_url,
  status,
  trial_ends_at,
  notes
) VALUES (
  'Detroit Web Agency (Matt — Internal)',
  'Matt Michels',
  'matthewmichels4@gmail.com',
  'hvac',
  'Metro Detroit',
  50,
  'We track who your best prospects are hiring — before they even post the job.',
  'TechAlert monitors job boards and licensing databases daily so you know the exact moment a qualified candidate surfaces in your market. No more spray-and-pray. $149/mo, cancel anytime.',
  'https://detroitwebagent.com/trial',
  'active',
  now() + interval '90 days',
  'Internal dogfood account — Matt sees exactly what paying clients see'
) ON CONFLICT DO NOTHING;

-- Seed today''s stats row so the dashboard shows something immediately
INSERT INTO outreach_campaign_stats (client_id, date, prospects_found, enriched, emails_sent, emails_opened, replies)
SELECT id, CURRENT_DATE, 0, 0, 0, 0, 0
FROM outreach_clients
WHERE company_name = 'Detroit Web Agency (Matt — Internal)'
ON CONFLICT (client_id, date) DO NOTHING;

-- increment_stat: atomic upsert + increment for per-client daily stats
-- Called by hunter, outreach, enrich, and followup-drip after each action.
CREATE OR REPLACE FUNCTION increment_stat(
  p_client_id uuid,
  p_col       text,
  p_amount    int DEFAULT 1
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Ensure today''s row exists
  INSERT INTO outreach_campaign_stats (client_id, date)
  VALUES (p_client_id, CURRENT_DATE)
  ON CONFLICT (client_id, date) DO NOTHING;

  -- Whitelist columns to prevent SQL injection
  IF p_col NOT IN ('prospects_found','enriched','emails_sent','emails_opened','replies','meetings_booked') THEN
    RAISE EXCEPTION 'Unknown stat column: %', p_col;
  END IF;

  EXECUTE format(
    'UPDATE outreach_campaign_stats SET %I = %I + $1 WHERE client_id = $2 AND date = CURRENT_DATE',
    p_col, p_col
  ) USING p_amount, p_client_id;
END;
$$;
