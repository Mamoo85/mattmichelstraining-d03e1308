CREATE TABLE IF NOT EXISTS public.contractor_lead_sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  trade TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'MI',
  active BOOLEAN DEFAULT true,
  active_contractor_id UUID REFERENCES public.contractor_clients(id),
  facebook_page_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.contractor_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID REFERENCES public.contractor_lead_sites(id),
  client_id UUID REFERENCES public.contractor_clients(id),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  message TEXT,
  project_type TEXT,
  source TEXT DEFAULT 'direct',
  status TEXT DEFAULT 'new',
  notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.contractor_lead_sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contractor_leads ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='contractor_lead_sites' AND policyname='admin_select_lead_sites') THEN
    CREATE POLICY admin_select_lead_sites ON public.contractor_lead_sites FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='contractor_lead_sites' AND policyname='admin_all_lead_sites') THEN
    CREATE POLICY admin_all_lead_sites ON public.contractor_lead_sites FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='contractor_leads' AND policyname='admin_select_leads') THEN
    CREATE POLICY admin_select_leads ON public.contractor_leads FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='contractor_leads' AND policyname='admin_all_leads') THEN
    CREATE POLICY admin_all_leads ON public.contractor_leads FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;