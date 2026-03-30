CREATE TABLE IF NOT EXISTS intake_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  business_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  service TEXT NOT NULL,
  message TEXT,
  ai_summary TEXT,
  fit_score TEXT DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'new',
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE intake_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages intake_leads"
  ON intake_leads FOR ALL TO service_role USING (true) WITH CHECK (true);
