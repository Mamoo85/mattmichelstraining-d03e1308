CREATE TABLE IF NOT EXISTS public.restaurant_menu_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  business_name TEXT,
  contact_name TEXT,
  cuisine_type TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  stripe_subscription_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.restaurant_menu_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_restaurant_menu_clients"
  ON public.restaurant_menu_clients FOR ALL TO service_role USING (true) WITH CHECK (true);
