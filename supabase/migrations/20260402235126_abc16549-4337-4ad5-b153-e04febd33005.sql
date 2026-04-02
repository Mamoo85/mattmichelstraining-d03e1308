CREATE TABLE IF NOT EXISTS public.missed_call_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  business_name text NOT NULL,
  phone text,
  custom_message text DEFAULT 'Hey, I just missed your call — I''ll call you right back! How can I help?',
  active boolean DEFAULT true,
  stripe_customer_id text,
  created_at timestamptz DEFAULT now(),
  last_triggered_at timestamptz
);

ALTER TABLE public.missed_call_clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on missed_call_clients"
  ON public.missed_call_clients
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

ALTER TABLE public.gbp_saas_clients ADD COLUMN IF NOT EXISTS post_tone text DEFAULT 'friendly';
ALTER TABLE public.gbp_saas_clients ADD COLUMN IF NOT EXISTS content_focus text;
ALTER TABLE public.gbp_saas_clients ADD COLUMN IF NOT EXISTS content_avoid text;

ALTER TABLE public.social_media_clients ADD COLUMN IF NOT EXISTS brand_voice text DEFAULT 'professional';
ALTER TABLE public.social_media_clients ADD COLUMN IF NOT EXISTS content_focus text;
ALTER TABLE public.social_media_clients ADD COLUMN IF NOT EXISTS content_avoid text;