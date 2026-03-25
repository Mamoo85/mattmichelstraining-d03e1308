-- Outreach leads table for web design cold email tracking
CREATE TABLE IF NOT EXISTS outreach_leads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_name TEXT NOT NULL,
  owner_name TEXT,
  city TEXT,
  industry TEXT CHECK (industry IN ('Plumber','Electrician','Landscaper','Roofer','Lawyer','MedSpa','Other')),
  phone TEXT,
  email TEXT,
  website_status TEXT CHECK (website_status IN ('None','Outdated','Basic','Good')) DEFAULT 'None',
  status TEXT CHECK (status IN ('New','Emailed','Responded','Closed','Lost')) DEFAULT 'New',
  last_contact_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE outreach_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trainer read" ON outreach_leads
  FOR SELECT USING (auth.jwt() ->> 'email' = 'matthew.michels4@gmail.com');

CREATE POLICY "Trainer insert" ON outreach_leads
  FOR INSERT WITH CHECK (auth.jwt() ->> 'email' = 'matthew.michels4@gmail.com');

CREATE POLICY "Trainer update" ON outreach_leads
  FOR UPDATE USING (auth.jwt() ->> 'email' = 'matthew.michels4@gmail.com');

CREATE POLICY "Trainer delete" ON outreach_leads
  FOR DELETE USING (auth.jwt() ->> 'email' = 'matthew.michels4@gmail.com');

-- Referral count on profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referral_count INTEGER DEFAULT 0;