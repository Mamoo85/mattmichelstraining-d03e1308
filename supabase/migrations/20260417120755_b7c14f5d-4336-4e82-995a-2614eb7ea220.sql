-- Radar Enhancements V1 — supports the 20 ship-now enhancements across all 4 Radars

-- Talent Radar
ALTER TABLE public.hire_alert_clients
  ADD COLUMN IF NOT EXISTS agency_priority boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS territory_counties text[] DEFAULT ARRAY['all_michigan']::text[];

ALTER TABLE public.hire_alert_candidates
  ADD COLUMN IF NOT EXISTS license_issued_at timestamptz,
  ADD COLUMN IF NOT EXISTS freshness_score smallint DEFAULT 0,
  ADD COLUMN IF NOT EXISTS source_count smallint DEFAULT 1;

ALTER TABLE public.hire_REDACTED
  ADD COLUMN IF NOT EXISTS contacted_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_hire_REDACTED
  ON public.hire_alert_candidates(freshness_score DESC, created_at DESC);

-- Demand Radar (Industry Pulse)
ALTER TABLE public.industry_pulse_clients
  ADD COLUMN IF NOT EXISTS confidence_min smallint DEFAULT 7,
  ADD COLUMN IF NOT EXISTS vendor_fit_input text,
  ADD COLUMN IF NOT EXISTS territory_counties text[] DEFAULT ARRAY['all_michigan']::text[];

ALTER TABLE public.industry_pulse_signals
  ADD COLUMN IF NOT EXISTS spend_window text,    -- '14d' | '30d' | '60d' | 'unknown'
  ADD COLUMN IF NOT EXISTS vendor_fit_score smallint;

-- Growth Radar (Industrial Growth Intel) — new dedicated client table
CREATE TABLE IF NOT EXISTS public.growth_radar_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  business_name text,
  contact_name text,
  phone text,
  county_filter text[] DEFAULT ARRAY['all_michigan']::text[],
  vertical_filter text[] DEFAULT ARRAY['all']::text[],
  active boolean NOT NULL DEFAULT true,
  stripe_customer_id text,
  stripe_subscription_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.growth_radar_clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "growth_radar_clients service" ON public.growth_radar_clients
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "growth_radar_clients admin" ON public.growth_radar_clients
  FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Lead Radar (Contractor Leads)
ALTER TABLE public.contractor_leads
  ADD COLUMN IF NOT EXISTS quality_score smallint,
  ADD COLUMN IF NOT EXISTS phone_verified boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS bidding_mode boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS attempt_count smallint DEFAULT 0,
  ADD COLUMN IF NOT EXISTS refunded_at timestamptz;

ALTER TABLE public.contractor_clients
  ADD COLUMN IF NOT EXISTS refund_credits_cents integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_contractor_leads_quality
  ON public.contractor_leads(quality_score DESC NULLS LAST, created_at DESC);
