-- Staffing agency clients (the "arms dealers" we sell to)
CREATE TABLE public.staffing_agency_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_name TEXT NOT NULL,
  contact_name TEXT,
  contact_email TEXT NOT NULL,
  contact_phone TEXT,
  vertical TEXT NOT NULL DEFAULT 'industrial', -- 'industrial' | 'healthcare'
  territory_counties TEXT[] DEFAULT ARRAY[]::TEXT[],
  pricing_model TEXT NOT NULL DEFAULT 'proof', -- 'proof' | 'performance' | 'territory_lock'
  territory_exclusive BOOLEAN NOT NULL DEFAULT false,
  monthly_retainer_cents INT,
  per_interview_fee_cents INT NOT NULL DEFAULT 25000,
  annual_prepay_cents INT,
  stripe_customer_id TEXT,
  stripe_payment_method_id TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.staffing_agency_clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on staffing_agency_clients"
  ON public.staffing_agency_clients FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Admins can view staffing agencies"
  ON public.staffing_agency_clients FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert staffing agencies"
  ON public.staffing_agency_clients FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update staffing agencies"
  ON public.staffing_agency_clients FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

-- Candidate assignments to agencies (the inventory pipeline)
CREATE TABLE public.agency_candidate_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES public.staffing_agency_clients(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES public.hire_alert_candidates(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'delivered', -- 'delivered'|'viewed'|'contacted'|'interview_booked'|'placed'|'rejected'
  signal_strength TEXT, -- color label: 'red'|'amber'|'green' (no numeric scores leaked)
  verification_id TEXT, -- opaque hash shown to agency
  pitch_summary TEXT, -- Opus-drafted "why this candidate matches" blurb
  delivered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  viewed_at TIMESTAMPTZ,
  interview_booked_at TIMESTAMPTZ,
  charged_at TIMESTAMPTZ,
  charge_amount_cents INT,
  stripe_charge_id TEXT,
  placed_at TIMESTAMPTZ,
  notes TEXT,
  UNIQUE(agency_id, candidate_id)
);

ALTER TABLE public.agency_candidate_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on agency_candidate_assignments"
  ON public.agency_candidate_assignments FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Admins can view agency assignments"
  ON public.agency_candidate_assignments FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_agency_assignments_agency ON public.agency_candidate_assignments(agency_id, delivered_at DESC);
CREATE INDEX idx_agency_assignments_status ON public.agency_candidate_assignments(status);

-- Territory exclusivity locks (the moat for $3500/mo tier)
CREATE TABLE public.agency_territory_locks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES public.staffing_agency_clients(id) ON DELETE CASCADE,
  vertical TEXT NOT NULL, -- 'industrial' | 'healthcare'
  county TEXT NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.agency_territory_locks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on agency_territory_locks"
  ON public.agency_territory_locks FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Admins can view territory locks"
  ON public.agency_territory_locks FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_territory_locks_active ON public.agency_territory_locks(vertical, county, active) WHERE active = true;

-- Auto-update timestamp trigger
CREATE TRIGGER update_staffing_agency_clients_updated_at
  BEFORE UPDATE ON public.staffing_agency_clients
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();