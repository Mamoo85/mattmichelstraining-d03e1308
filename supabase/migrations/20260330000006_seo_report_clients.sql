CREATE TABLE IF NOT EXISTS seo_report_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name TEXT NOT NULL,
  contact_name TEXT,
  email TEXT NOT NULL,
  phone TEXT,
  location TEXT,
  target_keywords TEXT[] DEFAULT '{}',
  gbp_location_id TEXT,
  stripe_subscription_id TEXT,
  active BOOLEAN NOT NULL DEFAULT false,
  last_report_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE seo_report_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages seo_report_clients"
  ON seo_report_clients FOR ALL TO service_role USING (true) WITH CHECK (true);
