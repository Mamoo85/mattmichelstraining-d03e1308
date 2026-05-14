
-- Google API spend log
CREATE TABLE IF NOT EXISTS public.google_api_spend_log (
  id BIGSERIAL PRIMARY KEY,
  function_name TEXT NOT NULL,
  api TEXT NOT NULL CHECK (api IN ('address_validation','places','streetview','geocoding','distance_matrix','pagespeed','other')),
  cost_cents NUMERIC(10,4) NOT NULL DEFAULT 0,
  called_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  meta JSONB
);
CREATE INDEX IF NOT EXISTS idx_gspend_called_at ON public.google_api_spend_log (called_at DESC);
CREATE INDEX IF NOT EXISTS idx_gspend_api_called ON public.google_api_spend_log (api, called_at DESC);

ALTER TABLE public.google_api_spend_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gspend_service_all ON public.google_api_spend_log;
CREATE POLICY gspend_service_all ON public.google_api_spend_log FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS gspend_admin_read ON public.google_api_spend_log;
CREATE POLICY gspend_admin_read ON public.google_api_spend_log FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Budget config (single row)
CREATE TABLE IF NOT EXISTS public.google_budget_config (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  daily_cap_cents INT NOT NULL DEFAULT 100,
  monthly_cap_cents INT NOT NULL DEFAULT 1500,
  kill_switch BOOLEAN NOT NULL DEFAULT false,
  alert_sent_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO public.google_budget_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.google_budget_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gbudget_service_all ON public.google_budget_config;
CREATE POLICY gbudget_service_all ON public.google_budget_config FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS gbudget_admin_all ON public.google_budget_config;
CREATE POLICY gbudget_admin_all ON public.google_budget_config FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Clear leaked street view URLs (contained the API key + billed every page view)
UPDATE public.trade_radar_leads SET street_view_url = NULL WHERE street_view_url IS NOT NULL;
