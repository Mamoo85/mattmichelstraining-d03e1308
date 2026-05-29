DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'business_listings') THEN
    CREATE TABLE public.business_listings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      business_name TEXT NOT NULL,
      owner_name TEXT,
      industry TEXT,
      city TEXT,
      state TEXT DEFAULT 'MI',
      phone TEXT,
      email TEXT,
      website TEXT,
      description TEXT,
      logo_url TEXT,
      tier TEXT DEFAULT 'free',
      is_featured BOOLEAN DEFAULT false,
      is_active BOOLEAN DEFAULT true,
      stripe_customer_id TEXT,
      source_table TEXT,
      source_id TEXT,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );
    ALTER TABLE public.business_listings ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'business_listings' AND policyname = 'Anyone can view active listings') THEN
    CREATE POLICY "Anyone can view active listings" ON public.business_listings FOR SELECT TO anon, authenticated USING (is_active = true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'business_listings' AND policyname = 'Admins manage listings') THEN
    CREATE POLICY "Admins manage listings" ON public.business_listings FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;