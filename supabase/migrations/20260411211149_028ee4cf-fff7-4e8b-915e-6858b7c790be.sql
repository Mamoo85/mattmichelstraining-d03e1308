
-- 1. field_service_techs
CREATE TABLE public.field_service_techs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES public.field_crm_clients(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  pin TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.field_service_techs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "srv_full_techs" ON public.field_service_techs TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "admin_all_techs" ON public.field_service_techs TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "anon_select_techs" ON public.field_service_techs FOR SELECT TO anon USING (true);

-- 2. field_service_customers
CREATE TABLE public.field_service_customers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES public.field_crm_clients(id) ON DELETE CASCADE NOT NULL,
  company_name TEXT NOT NULL,
  contact_name TEXT,
  address TEXT,
  city TEXT,
  phone TEXT,
  email TEXT,
  notes TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.field_service_customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "srv_full_cust" ON public.field_service_customers TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "admin_all_cust" ON public.field_service_customers TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 3. field_service_assets (before jobs, since jobs FK refs it)
CREATE TABLE public.field_service_assets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES public.field_crm_clients(id) ON DELETE CASCADE NOT NULL,
  customer_id UUID REFERENCES public.field_service_customers(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  asset_type TEXT,
  manufacturer TEXT,
  model TEXT,
  serial_number TEXT,
  install_date DATE,
  last_service_at TIMESTAMPTZ,
  location_notes TEXT,
  notes TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.field_service_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "srv_full_assets" ON public.field_service_assets TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "admin_all_assets" ON public.field_service_assets TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 4. field_service_jobs
CREATE TABLE public.field_service_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES public.field_crm_clients(id) ON DELETE CASCADE NOT NULL,
  customer_id UUID REFERENCES public.field_service_customers(id) ON DELETE SET NULL,
  asset_id UUID REFERENCES public.field_service_assets(id) ON DELETE SET NULL,
  assigned_tech_id UUID REFERENCES public.field_service_techs(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT NOT NULL DEFAULT 'normal',
  status TEXT NOT NULL DEFAULT 'open',
  scheduled_date DATE,
  scheduled_time TEXT,
  notes TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.field_service_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "srv_full_jobs" ON public.field_service_jobs TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "admin_all_jobs" ON public.field_service_jobs TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 5. field_service_contracts
CREATE TABLE public.field_service_contracts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES public.field_crm_clients(id) ON DELETE CASCADE NOT NULL,
  customer_id UUID REFERENCES public.field_service_customers(id) ON DELETE SET NULL,
  asset_id UUID REFERENCES public.field_service_assets(id) ON DELETE SET NULL,
  assigned_tech_id UUID REFERENCES public.field_service_techs(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  frequency TEXT NOT NULL DEFAULT 'monthly',
  next_due_date DATE NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.field_service_contracts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "srv_full_contracts" ON public.field_service_contracts TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "admin_all_contracts" ON public.field_service_contracts TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 6. job_notes
CREATE TABLE public.job_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID REFERENCES public.field_service_jobs(id) ON DELETE CASCADE NOT NULL,
  tech_id UUID REFERENCES public.field_service_techs(id) ON DELETE SET NULL,
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.job_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "srv_full_notes" ON public.job_notes TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "admin_all_notes" ON public.job_notes TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
