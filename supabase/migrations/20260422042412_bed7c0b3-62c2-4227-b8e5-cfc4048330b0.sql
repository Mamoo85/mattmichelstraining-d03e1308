CREATE TABLE IF NOT EXISTS public.pulse_alert_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  business_name TEXT,
  vertical_filter TEXT,
  city_filter TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  last_alert_at TIMESTAMPTZ,
  alert_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pulse_alert_clients_active ON public.pulse_alert_clients (active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_pulse_alert_clients_email ON public.pulse_alert_clients (email);

ALTER TABLE public.pulse_alert_clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_pulse_alert_clients"
  ON public.pulse_alert_clients FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "admins_select_pulse_alert_clients"
  ON public.pulse_alert_clients FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));
