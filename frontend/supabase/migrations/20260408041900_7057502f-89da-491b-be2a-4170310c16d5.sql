
CREATE TABLE seo_guard_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  business_name text,
  website_url text NOT NULL,
  phone text,
  keywords text[],
  gsc_property_url text,
  active boolean DEFAULT true,
  stripe_customer_id text,
  stripe_subscription_id text,
  trial_ends_at timestamptz,
  last_scan_at timestamptz,
  last_report_at timestamptz,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE seo_guard_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON seo_guard_clients FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE INDEX idx_seo_guard_clients_active ON seo_guard_clients (active, last_scan_at);

CREATE TABLE seo_guard_scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES seo_guard_clients(id) ON DELETE CASCADE,
  scan_date date NOT NULL,
  js_visibility_score integer,
  js_gap_detected boolean,
  keyword_ranks jsonb,
  rank_drops jsonb,
  indexed_pages integer,
  deindexed_pages text[],
  citation_score integer,
  ai_summary text,
  report_sent_at timestamptz,
  alert_sent boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE seo_guard_scans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON seo_guard_scans FOR ALL TO service_role USING (true) WITH CHECK (true);
