CREATE TABLE IF NOT EXISTS public.client_report_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  business_name TEXT,
  contact_name TEXT,
  agency_type TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  stripe_subscription_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.client_report_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_client_report_clients"
  ON public.client_report_clients FOR ALL TO service_role USING (true) WITH CHECK (true);
