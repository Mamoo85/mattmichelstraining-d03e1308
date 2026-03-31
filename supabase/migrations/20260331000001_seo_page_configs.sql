CREATE TABLE IF NOT EXISTS public.seo_page_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade TEXT NOT NULL,
  city TEXT NOT NULL,
  slug TEXT NOT NULL,
  page_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.seo_page_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_seo_page_configs"
  ON public.seo_page_configs FOR ALL TO service_role USING (true) WITH CHECK (true);
