
-- Industry Pulse Intelligence client table
CREATE TABLE IF NOT EXISTS public.industry_pulse_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  contact_name TEXT,
  target_industries TEXT[] DEFAULT '{}',
  target_roles TEXT[] DEFAULT '{}',
  dashboard_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  active BOOLEAN DEFAULT false,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  pricing_tier TEXT DEFAULT 'standard',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.industry_pulse_clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_full_access_industry_pulse_clients"
  ON public.industry_pulse_clients
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE INDEX idx_industry_pulse_clients_email ON public.industry_pulse_clients (email);
CREATE INDEX idx_industry_pulse_clients_token ON public.industry_pulse_clients (dashboard_token);
