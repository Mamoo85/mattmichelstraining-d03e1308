CREATE TABLE IF NOT EXISTS public.annual_review_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  business_name TEXT,
  contact_name TEXT,
  industry TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  stripe_subscription_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.annual_review_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_annual_review_clients"
  ON public.annual_review_clients FOR ALL TO service_role USING (true) WITH CHECK (true);
