-- Regulatory Filing Monitor tables
-- Product: $497/mo for manufacturers — NAICS-aware compliance filing automation

-- 1. Client table
CREATE TABLE IF NOT EXISTS reg_filing_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  customer_email text NOT NULL,
  customer_name text,
  company_name text NOT NULL,
  naics_codes text,
  state text,
  additional_states text,
  phone text,
  stripe_subscription_id text,
  subscription_status text NOT NULL DEFAULT 'active',
  onboarding_data jsonb,
  last_scan_at timestamptz,
  last_digest_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE reg_filing_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own reg filing data" ON reg_filing_clients FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role full access reg_filing_clients" ON reg_filing_clients FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX idx_reg_filing_clients_active ON reg_filing_clients(active) WHERE active = true;
CREATE INDEX idx_reg_filing_clients_email ON reg_filing_clients(customer_email);

-- 2. Regulatory items found
CREATE TABLE IF NOT EXISTS reg_filing_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES reg_filing_clients(id) ON DELETE CASCADE,
  source_url text,
  source_type text NOT NULL DEFAULT 'federal_register',
  title text,
  agency text,
  published_date date,
  summary text,
  impact_level text NOT NULL DEFAULT 'medium',
  action_required boolean NOT NULL DEFAULT false,
  deadline date,
  status text NOT NULL DEFAULT 'new',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(client_id, source_url)
);
ALTER TABLE reg_filing_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access reg_filing_items" ON reg_filing_items FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX idx_reg_filing_items_client ON reg_filing_items(client_id);
CREATE INDEX idx_reg_filing_items_status ON reg_filing_items(status);

-- 3. AI-generated draft filings
CREATE TABLE IF NOT EXISTS reg_filing_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES reg_filing_clients(id) ON DELETE CASCADE,
  item_id uuid REFERENCES reg_filing_items(id) ON DELETE SET NULL,
  title text NOT NULL,
  filing_type text,
  draft_html text NOT NULL,
  status text NOT NULL DEFAULT 'pending_approval',
  approved_at timestamptz,
  approved_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE reg_filing_drafts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access reg_filing_drafts" ON reg_filing_drafts FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX idx_reg_filing_drafts_client ON reg_filing_drafts(client_id);
CREATE INDEX idx_reg_filing_drafts_status ON reg_filing_drafts(status);

-- 4. Deadline calendar
CREATE TABLE IF NOT EXISTS reg_filing_deadlines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES reg_filing_clients(id) ON DELETE CASCADE,
  item_id uuid REFERENCES reg_filing_items(id) ON DELETE SET NULL,
  title text NOT NULL,
  due_date date NOT NULL,
  reminder_days int[] DEFAULT '{30,14,7,3,1}',
  last_reminded date,
  status text NOT NULL DEFAULT 'upcoming',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE reg_filing_deadlines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access reg_filing_deadlines" ON reg_filing_deadlines FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX idx_reg_filing_deadlines_due ON reg_filing_deadlines(due_date);
CREATE INDEX idx_reg_filing_deadlines_client ON reg_filing_deadlines(client_id);
