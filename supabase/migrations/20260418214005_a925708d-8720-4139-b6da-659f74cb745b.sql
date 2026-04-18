
-- Additive columns on hire_alert_candidates (nullable, no defaults that disrupt)
ALTER TABLE public.hire_alert_candidates
  ADD COLUMN IF NOT EXISTS availability_signal text,
  ADD COLUMN IF NOT EXISTS cyber_hygiene_score smallint,
  ADD COLUMN IF NOT EXISTS corroboration_score numeric(3,2),
  ADD COLUMN IF NOT EXISTS urgency_score numeric(5,2),
  ADD COLUMN IF NOT EXISTS personal_email_primary boolean,
  ADD COLUMN IF NOT EXISTS job_stability_index numeric(4,2),
  ADD COLUMN IF NOT EXISTS employer_headcount_delta integer,
  ADD COLUMN IF NOT EXISTS employer_domain_breached_recently boolean,
  ADD COLUMN IF NOT EXISTS password_compromised boolean,
  ADD COLUMN IF NOT EXISTS available_until date;

CREATE INDEX IF NOT EXISTS idx_hac_urgency ON public.hire_alert_candidates(urgency_score DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_hac_flight_risk ON public.hire_alert_candidates(flight_risk) WHERE flight_risk IS NOT NULL;

-- ====================================================================
-- permit_contractor_signals — Demand Radar contractor scoring cache
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.permit_contractor_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_name text NOT NULL,
  contractor_name_normalized text NOT NULL,
  county text,
  permits_30d integer DEFAULT 0,
  permits_60d integer DEFAULT 0,
  permits_90d integer DEFAULT 0,
  avg_permit_value numeric(12,2),
  permit_velocity_score numeric(8,2),
  growth_trajectory text,
  contractor_status text,
  weather_reactive boolean DEFAULT false,
  trade_mix jsonb,
  last_permit_at timestamptz,
  computed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(contractor_name_normalized)
);
CREATE INDEX IF NOT EXISTS idx_pcs_velocity ON public.permit_contractor_signals(permit_velocity_score DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_pcs_status ON public.permit_contractor_signals(contractor_status);

ALTER TABLE public.permit_contractor_signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role full access" ON public.permit_contractor_signals FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "admin read" ON public.permit_contractor_signals FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ====================================================================
-- permit_to_category_map — supply house routing reference
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.permit_to_category_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  permit_keyword text NOT NULL UNIQUE,
  supply_category text NOT NULL,
  trade text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.permit_to_category_map ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role full access" ON public.permit_to_category_map FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "admin read" ON public.permit_to_category_map FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Seed reference data
INSERT INTO public.permit_to_category_map (permit_keyword, supply_category, trade) VALUES
  ('electrical service', 'electrical', 'electrical'),
  ('electrical upgrade', 'electrical', 'electrical'),
  ('panel', 'electrical', 'electrical'),
  ('hvac', 'hvac_refrigeration', 'hvac'),
  ('rtu', 'hvac_refrigeration', 'hvac'),
  ('furnace', 'hvac_refrigeration', 'hvac'),
  ('air condition', 'hvac_refrigeration', 'hvac'),
  ('boiler', 'hvac_refrigeration', 'hvac'),
  ('plumbing', 'pvf', 'plumbing'),
  ('water heater', 'pvf', 'plumbing'),
  ('pipe', 'pvf', 'plumbing'),
  ('drain', 'pvf', 'plumbing'),
  ('roof', 'roofing', 'roofing')
ON CONFLICT (permit_keyword) DO NOTHING;

-- ====================================================================
-- dol_rapids_completions — federal apprenticeship pre-license signal
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.dol_rapids_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  apprentice_name text NOT NULL,
  trade text,
  occupation_code text,
  sponsor_name text,
  county text,
  state text DEFAULT 'MI',
  completion_date date,
  promoted_to_candidate boolean DEFAULT false,
  candidate_id uuid REFERENCES public.hire_alert_candidates(id) ON DELETE SET NULL,
  raw_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(apprentice_name, completion_date, sponsor_name)
);
CREATE INDEX IF NOT EXISTS idx_drc_county ON public.dol_rapids_completions(county, trade);
CREATE INDEX IF NOT EXISTS idx_drc_promoted ON public.dol_rapids_completions(promoted_to_candidate) WHERE promoted_to_candidate = false;

ALTER TABLE public.dol_rapids_completions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role full access" ON public.dol_rapids_completions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "admin read" ON public.dol_rapids_completions FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ====================================================================
-- dol_oes_wages — median wage benchmarks
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.dol_oes_wages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trade text NOT NULL,
  occupation_code text,
  msa text NOT NULL,
  median_hourly_wage numeric(7,2),
  median_annual_wage numeric(10,2),
  data_year integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(trade, msa, data_year)
);
ALTER TABLE public.dol_oes_wages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role full access" ON public.dol_oes_wages FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "admin read" ON public.dol_oes_wages FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Seed Detroit MSA wages (2024 BLS data)
INSERT INTO public.dol_oes_wages (trade, msa, median_hourly_wage, median_annual_wage, data_year) VALUES
  ('hvac', 'Detroit-Warren-Dearborn, MI', 28.40, 59072, 2024),
  ('electrical', 'Detroit-Warren-Dearborn, MI', 35.10, 73008, 2024),
  ('plumbing', 'Detroit-Warren-Dearborn, MI', 31.20, 64896, 2024),
  ('boiler', 'Detroit-Warren-Dearborn, MI', 36.85, 76648, 2024),
  ('rn', 'Detroit-Warren-Dearborn, MI', 38.50, 80080, 2024),
  ('lpn', 'Detroit-Warren-Dearborn, MI', 26.10, 54288, 2024),
  ('cna', 'Detroit-Warren-Dearborn, MI', 17.20, 35776, 2024)
ON CONFLICT (trade, msa, data_year) DO NOTHING;

-- ====================================================================
-- dol_whisard_violations — wage/hour violations as flight-risk + credit-risk signal
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.dol_whisard_violations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employer_name text NOT NULL,
  employer_name_normalized text NOT NULL,
  city text,
  state text,
  violation_count integer DEFAULT 1,
  bw_atp_amt numeric(12,2),
  ee_violtd_cnt integer,
  case_id text,
  findings_start_date date,
  findings_end_date date,
  raw_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_whisard_employer ON public.dol_whisard_violations(employer_name_normalized);

ALTER TABLE public.dol_whisard_violations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role full access" ON public.dol_whisard_violations FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "admin read" ON public.dol_whisard_violations FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ====================================================================
-- client_roi_monthly — monthly ROI rollup per TechAlert client
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.client_roi_monthly (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.hire_alert_clients(id) ON DELETE CASCADE,
  month_start date NOT NULL,
  candidates_surfaced integer DEFAULT 0,
  candidates_contacted integer DEFAULT 0,
  candidates_hired integer DEFAULT 0,
  estimated_fee_revenue numeric(10,2) DEFAULT 0,
  subscription_cost numeric(8,2) DEFAULT 0,
  roi_multiplier numeric(6,2),
  digest_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(client_id, month_start)
);
CREATE INDEX IF NOT EXISTS idx_crm_client_month ON public.client_roi_monthly(client_id, month_start DESC);

ALTER TABLE public.client_roi_monthly ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role full access" ON public.client_roi_monthly FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "admin read" ON public.client_roi_monthly FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ====================================================================
-- cross_product_signals — flight risk → contractor lead opportunities
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.cross_product_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_type text NOT NULL,
  source_table text,
  source_id uuid,
  employer_name text,
  trade text,
  county text,
  pitch_angle text,
  routed_to text,
  status text DEFAULT 'new',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cps_status ON public.cross_product_signals(status, signal_type);

ALTER TABLE public.cross_product_signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role full access" ON public.cross_product_signals FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "admin read" ON public.cross_product_signals FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
