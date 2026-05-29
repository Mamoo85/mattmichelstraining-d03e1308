-- Pricing tier model for all field_crm products.
-- Adds pricing_tier enum + column to field_crm_clients.
-- Creates dead_lead_credits table for a la carte Dead Lead Pool campaigns.
-- Does NOT alter existing client monthly_price values — only changes the default.

-- Pricing tiers
DO $$ BEGIN
  CREATE TYPE pricing_tier_enum AS ENUM ('founder', 'standard', 'enterprise');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Add pricing_tier column (existing rows default to 'standard', preserving their current prices)
ALTER TABLE field_crm_clients
  ADD COLUMN IF NOT EXISTS pricing_tier pricing_tier_enum NOT NULL DEFAULT 'standard';

-- Update the monthly_price column default to reflect standard pricing per product.
-- New signups should set monthly_price at the application layer based on product + tier.
-- Founder: site_radar=$1900, trade_radar=$2900, mortgage_radar=$2900, techalert=$2900
-- Standard: site_radar=$4900, trade_radar=$6900, mortgage_radar=$5900, techalert=$6900
-- (Values in cents. Dead Lead Pool clients have monthly_price=0; credits tracked separately.)

-- Dead Lead Pool credit ledger
CREATE TABLE IF NOT EXISTS dead_lead_credits (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       uuid NOT NULL REFERENCES field_crm_clients(id) ON DELETE CASCADE,
  campaign_id     uuid,                        -- links to the upload batch / campaign
  credits_purchased int NOT NULL DEFAULT 0,   -- leads purchased in this transaction
  credits_used      int NOT NULL DEFAULT 0,   -- consumed by outreach sends
  price_cents       int NOT NULL DEFAULT 0,   -- what was charged (59=5900, 250=9900, 500=17900)
  purchased_at    timestamptz NOT NULL DEFAULT now(),
  notes           text,
  CONSTRAINT credits_non_negative CHECK (credits_used >= 0 AND credits_purchased >= 0)
);

CREATE INDEX IF NOT EXISTS idx_dead_lead_credits_client_id ON dead_lead_credits(client_id);
CREATE INDEX IF NOT EXISTS idx_dead_lead_credits_campaign_id ON dead_lead_credits(campaign_id);

-- Helper view: remaining credits per client
CREATE OR REPLACE VIEW dead_lead_credits_remaining AS
SELECT
  client_id,
  SUM(credits_purchased) AS total_purchased,
  SUM(credits_used)      AS total_used,
  SUM(credits_purchased - credits_used) AS remaining
FROM dead_lead_credits
GROUP BY client_id;

-- RLS: service role only (admin operations)
ALTER TABLE dead_lead_credits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS dead_lead_credits_service_only ON dead_lead_credits;
CREATE POLICY dead_lead_credits_service_only ON dead_lead_credits
  USING (auth.role() = 'service_role');
