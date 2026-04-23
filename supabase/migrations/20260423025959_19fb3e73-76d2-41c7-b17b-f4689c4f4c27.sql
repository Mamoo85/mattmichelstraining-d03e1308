-- Mortgage Radar — pre-trigger mortgage lead intelligence

CREATE TABLE IF NOT EXISTS public.mortgage_radar_clients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  contact_name TEXT,
  business_name TEXT,
  nmls_number TEXT,
  phone TEXT,
  zip_codes TEXT[] DEFAULT ARRAY[]::TEXT[],
  extra_zip_count INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT true,
  is_founder BOOLEAN DEFAULT false,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  trial_ends_at TIMESTAMPTZ,
  last_digest_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mortgage_radar_clients_active ON public.mortgage_radar_clients (active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_mortgage_radar_clients_zips ON public.mortgage_radar_clients USING GIN (zip_codes);

ALTER TABLE public.mortgage_radar_clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role bypass mortgage_radar_clients"
  ON public.mortgage_radar_clients FOR ALL
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "admins read mortgage_radar_clients"
  ON public.mortgage_radar_clients FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- ===== Leads =====
CREATE TABLE IF NOT EXISTS public.mortgage_radar_leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT,
  address TEXT,
  city TEXT,
  state TEXT DEFAULT 'MI',
  zip TEXT,
  phone TEXT,
  email TEXT,
  signal_type TEXT NOT NULL,
  signal_source TEXT NOT NULL,
  signal_detail TEXT,
  signal_url TEXT,
  signal_date DATE,
  estimated_equity NUMERIC,
  estimated_loan_amount NUMERIC,
  score INTEGER NOT NULL DEFAULT 5 CHECK (score BETWEEN 1 AND 10),
  suggested_opener TEXT,
  best_call_window TEXT,
  raw JSONB,
  notified_client_ids UUID[] DEFAULT ARRAY[]::UUID[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mortgage_radar_leads_zip ON public.mortgage_radar_leads (zip);
CREATE INDEX IF NOT EXISTS idx_mortgage_radar_leads_score ON public.mortgage_radar_leads (score DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mortgage_radar_leads_signal_type ON public.mortgage_radar_leads (signal_type);
CREATE UNIQUE INDEX IF NOT EXISTS idx_mortgage_radar_leads_dedup
  ON public.mortgage_radar_leads (COALESCE(address,''), signal_type, COALESCE(signal_date, '1970-01-01'::date));

ALTER TABLE public.mortgage_radar_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role bypass mortgage_radar_leads"
  ON public.mortgage_radar_leads FOR ALL
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "admins read mortgage_radar_leads"
  ON public.mortgage_radar_leads FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- ===== Lead locks (atomic 7-day claim) =====
CREATE TABLE IF NOT EXISTS public.mortgage_radar_lead_locks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.mortgage_radar_leads(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.mortgage_radar_clients(id) ON DELETE CASCADE,
  locked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  outcome TEXT,
  notes TEXT,
  UNIQUE (lead_id)
);

CREATE INDEX IF NOT EXISTS idx_mortgage_radar_lead_locks_client ON public.mortgage_radar_lead_locks (client_id);
CREATE INDEX IF NOT EXISTS idx_mortgage_radar_lead_locks_expires ON public.mortgage_radar_lead_locks (expires_at);

ALTER TABLE public.mortgage_radar_lead_locks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role bypass mortgage_radar_lead_locks"
  ON public.mortgage_radar_lead_locks FOR ALL
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "admins read mortgage_radar_lead_locks"
  ON public.mortgage_radar_lead_locks FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- updated_at trigger on clients
CREATE OR REPLACE FUNCTION public.touch_mortgage_radar_clients()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_mortgage_radar_clients_touch ON public.mortgage_radar_clients;
CREATE TRIGGER trg_mortgage_radar_clients_touch
  BEFORE UPDATE ON public.mortgage_radar_clients
  FOR EACH ROW EXECUTE FUNCTION public.touch_mortgage_radar_clients();