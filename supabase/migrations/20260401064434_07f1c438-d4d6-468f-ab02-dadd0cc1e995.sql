
DO $$ BEGIN
  CREATE TABLE IF NOT EXISTS public.generated_sites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID REFERENCES public.web_design_leads(id) ON DELETE SET NULL,
    template_key TEXT NOT NULL DEFAULT 'contractor',
    slug TEXT NOT NULL UNIQUE,
    business_name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    address TEXT,
    sections JSONB NOT NULL DEFAULT '[]'::jsonb,
    color_scheme JSONB NOT NULL DEFAULT '{"primary":"#e8621a","secondary":"#1e293b","accent":"#059669"}'::jsonb,
    logo_url TEXT,
    is_published BOOLEAN NOT NULL DEFAULT false,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
EXCEPTION WHEN duplicate_table THEN NULL;
END $$;

ALTER TABLE public.generated_sites ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service role full access on generated_sites' AND tablename = 'generated_sites') THEN
    CREATE POLICY "Service role full access on generated_sites" ON public.generated_sites FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can manage all sites' AND tablename = 'generated_sites') THEN
    CREATE POLICY "Admins can manage all sites" ON public.generated_sites FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public can view published sites' AND tablename = 'generated_sites') THEN
    CREATE POLICY "Public can view published sites" ON public.generated_sites FOR SELECT TO anon USING (is_published = true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated can view published sites' AND tablename = 'generated_sites') THEN
    CREATE POLICY "Authenticated can view published sites" ON public.generated_sites FOR SELECT TO authenticated USING (is_published = true);
  END IF;
END $$;
