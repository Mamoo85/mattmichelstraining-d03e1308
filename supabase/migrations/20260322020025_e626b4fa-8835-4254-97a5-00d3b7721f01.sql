
CREATE TABLE public.seo_landing_pages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  page_title TEXT NOT NULL,
  meta_description TEXT NOT NULL DEFAULT '',
  h1_heading TEXT NOT NULL DEFAULT '',
  main_content TEXT NOT NULL DEFAULT '',
  target_audience TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.seo_landing_pages ENABLE ROW LEVEL SECURITY;

-- Public read access for SEO pages
CREATE POLICY "Anyone can read seo landing pages"
  ON public.seo_landing_pages
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Only admins can manage
CREATE POLICY "Admins can manage seo landing pages"
  ON public.seo_landing_pages
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
