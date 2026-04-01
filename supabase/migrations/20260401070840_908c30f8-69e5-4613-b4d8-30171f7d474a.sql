DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'seo_page_configs' AND column_name = 'category') THEN
    ALTER TABLE public.seo_page_configs ADD COLUMN category TEXT DEFAULT 'contractor';
  END IF;
END $$;

UPDATE public.seo_page_configs SET category = 'contractor' WHERE category IS NULL;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'seo_page_configs' AND policyname = 'Anyone can read SEO pages') THEN
    CREATE POLICY "Anyone can read SEO pages" ON public.seo_page_configs FOR SELECT TO anon, authenticated USING (true);
  END IF;
END $$;