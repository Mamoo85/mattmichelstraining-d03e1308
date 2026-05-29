CREATE TABLE IF NOT EXISTS public.ads_copy_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name TEXT NOT NULL,
  contact_name TEXT,
  email TEXT NOT NULL UNIQUE,
  city TEXT,
  services TEXT,
  stripe_subscription_id TEXT,
  active BOOLEAN NOT NULL DEFAULT false,
  copy_count INT NOT NULL DEFAULT 0,
  last_generated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.ads_copy_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages ads_copy_clients"
  ON public.ads_copy_clients FOR ALL TO service_role USING (true) WITH CHECK (true);
