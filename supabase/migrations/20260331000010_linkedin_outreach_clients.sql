CREATE TABLE IF NOT EXISTS public.linkedin_outreach_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  business_name TEXT,
  contact_name TEXT,
  industry TEXT,
  target_title TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  stripe_subscription_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.linkedin_outreach_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_linkedin_outreach_clients"
  ON public.linkedin_outreach_clients FOR ALL TO service_role USING (true) WITH CHECK (true);
