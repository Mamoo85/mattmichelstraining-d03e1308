CREATE TABLE IF NOT EXISTS public.press_release_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name TEXT NOT NULL,
  contact_name TEXT,
  email TEXT NOT NULL UNIQUE,
  city TEXT,
  industry TEXT,
  business_description TEXT,
  stripe_subscription_id TEXT,
  active BOOLEAN NOT NULL DEFAULT false,
  release_count INT NOT NULL DEFAULT 0,
  last_release_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.press_release_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages press_release_clients"
  ON public.press_release_clients FOR ALL TO service_role USING (true) WITH CHECK (true);
