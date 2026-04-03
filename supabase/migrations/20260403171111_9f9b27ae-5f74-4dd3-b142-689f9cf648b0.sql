
-- 1. Fix RLS: Add INSERT policies for authenticated users on 4 tables
CREATE POLICY "Authenticated can insert competitor_watch_clients"
  ON public.competitor_watch_clients FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated can insert linkedin_ghostwriting_clients"
  ON public.linkedin_ghostwriting_clients FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated can insert market_intel_clients"
  ON public.market_intel_clients FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated can insert newsletter_service_clients"
  ON public.newsletter_service_clients FOR INSERT TO authenticated
  WITH CHECK (true);

-- 2. Fix missing column on local_seo_clients
ALTER TABLE public.local_seo_clients ADD COLUMN IF NOT EXISTS contact_name text;

-- 3. Create missing social_captions_clients table
CREATE TABLE IF NOT EXISTS public.social_captions_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  contact_name text,
  business_name text NOT NULL,
  industry text,
  active boolean DEFAULT false,
  caption_count integer DEFAULT 0,
  last_sent_at timestamptz,
  stripe_customer_id text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.social_captions_clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read social_captions_clients"
  ON public.social_captions_clients FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = (select auth.uid()) AND role = 'admin'
    )
  );

CREATE POLICY "service_role_full_social_captions"
  ON public.social_captions_clients FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated can insert social_captions_clients"
  ON public.social_captions_clients FOR INSERT TO authenticated
  WITH CHECK (true);
