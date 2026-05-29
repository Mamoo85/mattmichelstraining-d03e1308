CREATE TABLE public.micro_saas_tools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  h1_headline TEXT NOT NULL,
  seo_meta_title TEXT NOT NULL,
  seo_meta_description TEXT NOT NULL,
  target_audience TEXT NOT NULL DEFAULT '',
  core_pain_point TEXT NOT NULL DEFAULT '',
  monthly_price INTEGER NOT NULL DEFAULT 0,
  stripe_checkout_url TEXT,
  stripe_price_id TEXT,
  features_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  category TEXT NOT NULL DEFAULT 'general',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.micro_saas_tools ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active tools"
  ON public.micro_saas_tools FOR SELECT TO anon, authenticated
  USING (is_active = true);

CREATE POLICY "Service role full access"
  ON public.micro_saas_tools FOR ALL TO service_role
  USING (true) WITH CHECK (true);