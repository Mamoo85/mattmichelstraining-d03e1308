CREATE TABLE IF NOT EXISTS public.testimonial_harvester_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  business_name TEXT,
  contact_name TEXT,
  service_type TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  stripe_subscription_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.testimonial_harvester_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_testimonial_harvester_clients"
  ON public.testimonial_harvester_clients FOR ALL TO service_role USING (true) WITH CHECK (true);
