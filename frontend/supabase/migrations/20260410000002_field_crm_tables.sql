-- Field CRM: multi-tenant CRM for HVAC/field service companies
-- Tables: field_crm_clients, crm_visitor_events, tech_locations, review_blast_log, competitor_review_alerts

-- ── Clients (paying subscribers) ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS field_crm_clients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_name TEXT NOT NULL,
  owner_name TEXT,
  phone TEXT,
  email TEXT,
  industry TEXT DEFAULT 'hvac',
  website TEXT,
  visitor_script_key UUID DEFAULT gen_random_uuid(),  -- unique per client for JS snippet auth
  google_review_url TEXT,                              -- direct Google review link for review blasts
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  status TEXT DEFAULT 'active',
  plan TEXT DEFAULT 'standard',
  monthly_price INTEGER DEFAULT 19900,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE field_crm_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on field_crm_clients"
  ON field_crm_clients FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Admin select field_crm_clients"
  ON field_crm_clients FOR SELECT TO authenticated
  USING ((auth.jwt() ->> 'user_role') = 'admin');
CREATE POLICY "Admin insert field_crm_clients"
  ON field_crm_clients FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() ->> 'user_role') = 'admin');
CREATE POLICY "Admin update field_crm_clients"
  ON field_crm_clients FOR UPDATE TO authenticated
  USING ((auth.jwt() ->> 'user_role') = 'admin');

-- ── Visitor Events (anonymous B2B visitor identification) ──────────────────────
CREATE TABLE IF NOT EXISTS crm_visitor_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES field_crm_clients(id) ON DELETE CASCADE,
  visitor_script_key UUID NOT NULL,
  ip_address TEXT,
  company_name TEXT,
  org TEXT,
  city TEXT,
  region TEXT,
  country TEXT,
  isp TEXT,
  is_business BOOLEAN DEFAULT false,
  page_visited TEXT,
  referrer TEXT,
  visit_count INTEGER DEFAULT 1,
  enrichment_data JSONB DEFAULT '{}',
  lead_auto_created BOOLEAN DEFAULT false,
  pipeline_lead_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE crm_visitor_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on crm_visitor_events"
  ON crm_visitor_events FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Admin select crm_visitor_events"
  ON crm_visitor_events FOR SELECT TO authenticated
  USING ((auth.jwt() ->> 'user_role') = 'admin');

CREATE INDEX IF NOT EXISTS idx_crm_visitor_events_client_id ON crm_visitor_events(client_id);
CREATE INDEX IF NOT EXISTS idx_crm_visitor_events_created_at ON crm_visitor_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_visitor_events_script_key ON crm_visitor_events(visitor_script_key);

-- ── Tech Locations (GPS clock-in/out for field techs) ─────────────────────────
CREATE TABLE IF NOT EXISTS tech_locations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES field_crm_clients(id) ON DELETE CASCADE,
  tech_name TEXT NOT NULL,
  tech_phone TEXT,
  lat DECIMAL(9,6),
  lng DECIMAL(9,6),
  address TEXT,
  status TEXT DEFAULT 'offline',  -- active | on_job | driving | offline
  current_job TEXT,
  clocked_in_at TIMESTAMPTZ,
  clocked_out_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE tech_locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on tech_locations"
  ON tech_locations FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Admin select tech_locations"
  ON tech_locations FOR SELECT TO authenticated
  USING ((auth.jwt() ->> 'user_role') = 'admin');

CREATE INDEX IF NOT EXISTS idx_tech_locations_client_id ON tech_locations(client_id);

-- ── Review Blast Log (post-job Google review requests) ────────────────────────
CREATE TABLE IF NOT EXISTS review_blast_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES field_crm_clients(id) ON DELETE CASCADE,
  customer_name TEXT,
  customer_phone TEXT NOT NULL,
  job_description TEXT,
  tech_name TEXT,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  clicked_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'sent'  -- sent | clicked | reviewed | failed
);

ALTER TABLE review_blast_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on review_blast_log"
  ON review_blast_log FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Admin select review_blast_log"
  ON review_blast_log FOR SELECT TO authenticated
  USING ((auth.jwt() ->> 'user_role') = 'admin');

CREATE INDEX IF NOT EXISTS idx_review_blast_log_client_id ON review_blast_log(client_id);
CREATE INDEX IF NOT EXISTS idx_review_blast_log_tech_name ON review_blast_log(tech_name);

-- ── Competitor Review Alerts (1-star poaching) ────────────────────────────────
CREATE TABLE IF NOT EXISTS competitor_review_alerts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES field_crm_clients(id) ON DELETE CASCADE,
  competitor_name TEXT NOT NULL,
  competitor_place_id TEXT,
  platform TEXT DEFAULT 'google',
  star_rating INTEGER,
  review_text TEXT,
  reviewer_name TEXT,
  outreach_sent BOOLEAN DEFAULT false,
  outreach_sent_at TIMESTAMPTZ,
  outreach_phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE competitor_review_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on competitor_review_alerts"
  ON competitor_review_alerts FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Admin select competitor_review_alerts"
  ON competitor_review_alerts FOR SELECT TO authenticated
  USING ((auth.jwt() ->> 'user_role') = 'admin');

CREATE INDEX IF NOT EXISTS idx_competitor_review_alerts_client_id ON competitor_review_alerts(client_id);
