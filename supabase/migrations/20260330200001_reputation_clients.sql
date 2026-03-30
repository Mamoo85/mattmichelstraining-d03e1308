CREATE TABLE IF NOT EXISTS public.reputation_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name TEXT NOT NULL,
  contact_name TEXT,
  email TEXT NOT NULL UNIQUE,
  website TEXT,
  stripe_subscription_id TEXT,
  active BOOLEAN NOT NULL DEFAULT false,
  report_count INT NOT NULL DEFAULT 0,
  last_report_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.reputation_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages reputation_clients"
  ON public.reputation_clients FOR ALL TO service_role USING (true) WITH CHECK (true);
