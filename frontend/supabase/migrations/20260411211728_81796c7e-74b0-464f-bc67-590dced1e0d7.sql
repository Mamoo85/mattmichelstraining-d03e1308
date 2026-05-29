-- ============================================
-- 1. hire_alert_clients
-- ============================================
CREATE TABLE IF NOT EXISTS public.hire_alert_clients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_name TEXT NOT NULL,
  owner_email TEXT NOT NULL UNIQUE,
  owner_phone TEXT,
  plan TEXT DEFAULT 'standalone',
  target_roles TEXT[] DEFAULT ARRAY['boiler_operator','hvac_tech'],
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.hire_alert_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_hire_alert_clients" ON public.hire_alert_clients FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "admin_select_hire_alert_clients" ON public.hire_alert_clients FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin_all_hire_alert_clients" ON public.hire_alert_clients FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============================================
-- 2. hire_alert_candidates
-- ============================================
CREATE TABLE IF NOT EXISTS public.hire_alert_candidates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES public.hire_alert_clients(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  trade TEXT,
  city TEXT,
  state TEXT DEFAULT 'MI',
  license_type TEXT,
  license_number TEXT,
  source TEXT,
  phone TEXT,
  email TEXT,
  score INTEGER DEFAULT 0,
  status TEXT DEFAULT 'new',
  alerted_at TIMESTAMPTZ,
  raw_data JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.hire_alert_candidates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_hire_alert_candidates" ON public.hire_alert_candidates FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "admin_all_hire_alert_candidates" ON public.hire_alert_candidates FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============================================
-- 3. hire_alert_runs
-- ============================================
CREATE TABLE IF NOT EXISTS public.hire_alert_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  candidates_found INTEGER DEFAULT 0,
  candidates_alerted INTEGER DEFAULT 0,
  status TEXT DEFAULT 'running',
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.hire_alert_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_hire_alert_runs" ON public.hire_alert_runs FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "admin_all_hire_alert_runs" ON public.hire_alert_runs FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============================================
-- 4. Add missing columns to contractor_clients
-- ============================================
ALTER TABLE public.contractor_clients ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.contractor_clients ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.contractor_clients ADD COLUMN IF NOT EXISTS trade TEXT;
ALTER TABLE public.contractor_clients ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE public.contractor_clients ADD COLUMN IF NOT EXISTS state TEXT DEFAULT 'MI';
ALTER TABLE public.contractor_clients ADD COLUMN IF NOT EXISTS onboarded_at TIMESTAMPTZ;
ALTER TABLE public.contractor_clients ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;