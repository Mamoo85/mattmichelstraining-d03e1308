-- Agency white-label subscription clients

CREATE TABLE IF NOT EXISTS public.agency_whitelabel_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_name text NOT NULL,
  contact_name text,
  email text NOT NULL,
  phone text,
  stripe_customer_id text,
  stripe_subscription_id text,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.agency_whitelabel_clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_bypass" ON public.agency_whitelabel_clients
  USING (auth.role() = 'service_role');

CREATE UNIQUE INDEX IF NOT EXISTS idx_agency_whitelabel_clients_email
  ON public.agency_whitelabel_clients (email);
