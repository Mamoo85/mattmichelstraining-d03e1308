-- HOA lead magnet captures
CREATE TABLE IF NOT EXISTS hoa_leads (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  email text UNIQUE NOT NULL,
  name text,
  hoa_name text,
  home_count text,
  source text,
  next_followup_at timestamptz,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE hoa_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON hoa_leads TO service_role USING (true) WITH CHECK (true);

-- HOA cold outreach prospects (property management companies)
CREATE TABLE IF NOT EXISTS hoa_outreach_prospects (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_name text,
  website text,
  email text UNIQUE,
  status text DEFAULT 'pending',
  next_followup_at timestamptz,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE hoa_outreach_prospects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON hoa_outreach_prospects TO service_role USING (true) WITH CHECK (true);

-- Cron: HOA cold outreach every Monday 7am ET
SELECT cron.schedule('hoa-cold-outreach', '0 12 * * 1', $$
  SELECT net.http_post(
    url := 'https://zmyczlfuufhngzovkjdh.supabase.co/functions/v1/hoa-cold-outreach',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.service_role_key', true) || '"}'::jsonb,
    body := '{}'::jsonb
  );
$$);
