CREATE TABLE IF NOT EXISTS public.podcast_pitch_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  business_name TEXT,
  contact_name TEXT,
  expertise TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  stripe_subscription_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.podcast_pitch_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_podcast_pitch_clients"
  ON public.podcast_pitch_clients FOR ALL TO service_role USING (true) WITH CHECK (true);
