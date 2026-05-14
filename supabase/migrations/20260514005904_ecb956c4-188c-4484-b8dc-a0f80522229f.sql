CREATE TABLE IF NOT EXISTS public.api_usage_daily (
  id bigserial PRIMARY KEY,
  service text NOT NULL,
  usage_date date NOT NULL DEFAULT CURRENT_DATE,
  cents_used numeric(10,2) NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (service, usage_date)
);
ALTER TABLE public.api_usage_daily ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public.api_usage_daily USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');