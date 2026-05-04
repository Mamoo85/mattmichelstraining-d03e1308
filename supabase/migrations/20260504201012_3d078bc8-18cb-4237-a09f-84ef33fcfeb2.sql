ALTER TABLE public.mortgage_radar_clients
  ADD COLUMN IF NOT EXISTS crm_webhook_url text,
  ADD COLUMN IF NOT EXISTS crm_webhook_secret text;

ALTER TABLE public.trade_radar_clients
  ADD COLUMN IF NOT EXISTS crm_webhook_url text,
  ADD COLUMN IF NOT EXISTS crm_webhook_secret text;

ALTER TABLE public.hire_alert_clients
  ADD COLUMN IF NOT EXISTS crm_webhook_url text,
  ADD COLUMN IF NOT EXISTS crm_webhook_secret text;

CREATE TABLE IF NOT EXISTS public.crm_webhook_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product text NOT NULL,
  client_id uuid,
  payload_summary text,
  status_code int,
  ok boolean NOT NULL DEFAULT false,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.crm_webhook_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role bypass crm_webhook_deliveries" ON public.crm_webhook_deliveries
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "admins read crm_webhook_deliveries" ON public.crm_webhook_deliveries
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_crm_webhook_deliveries_created ON public.crm_webhook_deliveries (created_at DESC);