CREATE TABLE IF NOT EXISTS public.insurance_drip_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  business_name TEXT,
  contact_name TEXT,
  insurance_type TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  stripe_subscription_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.insurance_drip_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_insurance_drip_clients"
  ON public.insurance_drip_clients FOR ALL TO service_role USING (true) WITH CHECK (true);
