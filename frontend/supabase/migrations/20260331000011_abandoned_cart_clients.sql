CREATE TABLE IF NOT EXISTS public.abandoned_cart_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  business_name TEXT,
  contact_name TEXT,
  platform TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  stripe_subscription_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.abandoned_cart_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_abandoned_cart_clients"
  ON public.abandoned_cart_clients FOR ALL TO service_role USING (true) WITH CHECK (true);
