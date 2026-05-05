
-- Source health manifest
CREATE TABLE IF NOT EXISTS public.source_run_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_name TEXT NOT NULL,
  vertical TEXT,
  scanner_function TEXT,
  attempted BOOLEAN NOT NULL DEFAULT true,
  rows_fetched INT DEFAULT 0,
  rows_inserted INT DEFAULT 0,
  rows_quarantined INT DEFAULT 0,
  error_message TEXT,
  duration_ms INT,
  run_meta JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_source_run_results_source_time ON public.source_run_results (source_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_source_run_results_vertical_time ON public.source_run_results (vertical, created_at DESC);
ALTER TABLE public.source_run_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_source_run_results" ON public.source_run_results FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "admin_read_source_run_results" ON public.source_run_results FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Deployment drift log
CREATE TABLE IF NOT EXISTS public.deployment_drift_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  function_name TEXT NOT NULL,
  repo_hash TEXT,
  deployed_hash TEXT,
  drift_detected BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_deployment_drift_function_time ON public.deployment_drift_log (function_name, checked_at DESC);
ALTER TABLE public.deployment_drift_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_deployment_drift" ON public.deployment_drift_log FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "admin_read_deployment_drift" ON public.deployment_drift_log FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Trial delivery SLA tracking
CREATE TABLE IF NOT EXISTS public.trial_delivery_sla (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_email TEXT NOT NULL,
  product_slug TEXT NOT NULL,
  trial_started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  trial_ends_at TIMESTAMPTZ NOT NULL,
  promised_leads_per_week INT DEFAULT 0,
  leads_delivered INT DEFAULT 0,
  last_lead_at TIMESTAMPTZ,
  last_check_at TIMESTAMPTZ,
  welcome_pulse_sent_at TIMESTAMPTZ,
  day2_pulse_sent_at TIMESTAMPTZ,
  day5_pulse_sent_at TIMESTAMPTZ,
  day6_pulse_sent_at TIMESTAMPTZ,
  sla_status TEXT DEFAULT 'on_track',
  auto_extended BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(customer_email, product_slug, trial_started_at)
);
CREATE INDEX IF NOT EXISTS idx_trial_sla_status ON public.trial_delivery_sla (sla_status, trial_ends_at);
CREATE INDEX IF NOT EXISTS idx_trial_sla_active ON public.trial_delivery_sla (trial_ends_at) WHERE sla_status IN ('on_track','at_risk','breached');
ALTER TABLE public.trial_delivery_sla ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_trial_sla" ON public.trial_delivery_sla FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "admin_read_trial_sla" ON public.trial_delivery_sla FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Trial concierge log
CREATE TABLE IF NOT EXISTS public.trial_concierge_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trial_sla_id UUID REFERENCES public.trial_delivery_sla(id) ON DELETE CASCADE,
  customer_email TEXT NOT NULL,
  touch_type TEXT NOT NULL,
  channel TEXT NOT NULL,
  body_preview TEXT,
  delivery_status TEXT,
  meta JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_trial_concierge_email_time ON public.trial_concierge_log (customer_email, created_at DESC);
ALTER TABLE public.trial_concierge_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_trial_concierge" ON public.trial_concierge_log FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "admin_read_trial_concierge" ON public.trial_concierge_log FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
