-- Talent Radar: separate product for staffing agencies
-- Distinct from hire_alert_clients (which targets employers wanting to hire directly)

CREATE TABLE IF NOT EXISTS public.talent_radar_clients (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_name text,
  owner_email text NOT NULL,
  owner_name text,
  owner_phone text,
  stripe_customer_id text,
  stripe_subscription_id text,
  plan text DEFAULT 'sheet', -- 'sheet' | 'starter' | 'pro' | 'agency'
  active boolean DEFAULT false,
  target_verticals text[] DEFAULT ARRAY['trades'],
  target_states text[] DEFAULT ARRAY['MI'],
  sheets_requested int DEFAULT 0,
  sheets_generated int DEFAULT 0,
  dashboard_token text UNIQUE DEFAULT gen_random_uuid()::text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.talent_radar_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public.talent_radar_clients FOR ALL TO service_role USING (true);

-- Each generated sheet is a snapshot of 10 enriched candidates
CREATE TABLE IF NOT EXISTS public.talent_radar_sheets (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid REFERENCES public.talent_radar_clients(id),
  vertical text NOT NULL,          -- 'trades' | 'healthcare' | 'electrical' | 'plumbing'
  state text DEFAULT 'MI',
  candidate_count int DEFAULT 0,
  candidates jsonb DEFAULT '[]'::jsonb,
  stripe_session_id text,
  downloaded_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.talent_radar_sheets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public.talent_radar_sheets FOR ALL TO service_role USING (true);
