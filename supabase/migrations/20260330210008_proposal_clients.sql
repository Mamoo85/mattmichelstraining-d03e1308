CREATE TABLE IF NOT EXISTS public.proposal_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name TEXT NOT NULL,
  contact_name TEXT,
  email TEXT NOT NULL UNIQUE,
  industry TEXT,
  stripe_subscription_id TEXT,
  active BOOLEAN NOT NULL DEFAULT false,
  proposals_generated INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.proposal_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages proposal_clients"
  ON public.proposal_clients FOR ALL TO service_role USING (true) WITH CHECK (true);
