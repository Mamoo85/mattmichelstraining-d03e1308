CREATE TABLE IF NOT EXISTS public.new_mover_marketing_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  business_name TEXT,
  contact_name TEXT,
  service_area TEXT,
  trade TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  stripe_subscription_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.new_mover_marketing_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_new_mover_marketing_clients"
  ON public.new_mover_marketing_clients FOR ALL TO service_role USING (true) WITH CHECK (true);
