-- Bid Intelligence & Proposal Factory tables
-- Product: $599/mo for commercial subcontractors — AI bid scanning + auto-proposals

-- 1. Client table
CREATE TABLE IF NOT EXISTS bid_intel_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  customer_email text NOT NULL,
  customer_name text,
  company_name text NOT NULL,
  trade text NOT NULL,
  service_territory text,
  max_bid_radius_miles int DEFAULT 50,
  phone text,
  historical_pricing jsonb,
  bid_board_urls text[],
  stripe_subscription_id text,
  subscription_status text NOT NULL DEFAULT 'active',
  last_scan_at timestamptz,
  last_digest_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE bid_intel_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own bid intel data" ON bid_intel_clients FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role full access bid_intel_clients" ON bid_intel_clients FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX idx_bid_intel_clients_active ON bid_intel_clients(active) WHERE active = true;
CREATE INDEX idx_bid_intel_clients_email ON bid_intel_clients(customer_email);

-- 2. Discovered bid opportunities
CREATE TABLE IF NOT EXISTS bid_intel_opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES bid_intel_clients(id) ON DELETE CASCADE,
  source_url text,
  source_name text,
  title text NOT NULL,
  description text,
  owner_agency text,
  location text,
  trade_match text,
  bid_due_date timestamptz,
  estimated_value text,
  fit_score int,
  status text NOT NULL DEFAULT 'new',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(client_id, source_url)
);
ALTER TABLE bid_intel_opportunities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access bid_intel_opportunities" ON bid_intel_opportunities FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX idx_bid_intel_opps_client ON bid_intel_opportunities(client_id);
CREATE INDEX idx_bid_intel_opps_score ON bid_intel_opportunities(fit_score);
CREATE INDEX idx_bid_intel_opps_due ON bid_intel_opportunities(bid_due_date);

-- 3. AI-generated proposal drafts
CREATE TABLE IF NOT EXISTS bid_intel_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES bid_intel_clients(id) ON DELETE CASCADE,
  opportunity_id uuid REFERENCES bid_intel_opportunities(id) ON DELETE SET NULL,
  title text NOT NULL,
  proposal_html text NOT NULL,
  estimated_total text,
  status text NOT NULL DEFAULT 'pending_approval',
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE bid_intel_proposals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access bid_intel_proposals" ON bid_intel_proposals FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX idx_bid_intel_proposals_client ON bid_intel_proposals(client_id);
CREATE INDEX idx_bid_intel_proposals_status ON bid_intel_proposals(status);
