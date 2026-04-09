
-- 1. Tenants table
CREATE TABLE public.tenants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  company_name TEXT NOT NULL DEFAULT '',
  domain TEXT,
  branding JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenants: owner can select own row"
  ON public.tenants FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Tenants: owner can update own row"
  ON public.tenants FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Tenants: service_role bypass"
  ON public.tenants FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Helper function (table exists now)
CREATE OR REPLACE FUNCTION public.get_tenant_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.tenants WHERE user_id = _user_id LIMIT 1;
$$;

-- 2. Tenant Leads table
CREATE TABLE public.tenant_leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  first_name TEXT,
  last_name TEXT,
  company_name TEXT,
  job_title TEXT,
  email TEXT,
  validated_email BOOLEAN DEFAULT false,
  phone TEXT,
  website TEXT,
  linkedin_url TEXT,
  enrichment_data JSONB DEFAULT '{}',
  drip_campaign_status JSONB DEFAULT '{}',
  source TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.tenant_leads ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_tenant_leads_tenant_id ON public.tenant_leads(tenant_id);
CREATE INDEX idx_tenant_leads_email ON public.tenant_leads(email);

CREATE POLICY "Tenant leads: owner can select"
  ON public.tenant_leads FOR SELECT TO authenticated
  USING (tenant_id = public.get_tenant_id(auth.uid()));

CREATE POLICY "Tenant leads: owner can update"
  ON public.tenant_leads FOR UPDATE TO authenticated
  USING (tenant_id = public.get_tenant_id(auth.uid()));

CREATE POLICY "Tenant leads: owner can delete"
  ON public.tenant_leads FOR DELETE TO authenticated
  USING (tenant_id = public.get_tenant_id(auth.uid()));

CREATE POLICY "Tenant leads: service_role bypass"
  ON public.tenant_leads FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE TRIGGER update_tenant_leads_updated_at
  BEFORE UPDATE ON public.tenant_leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Capture Submissions table
CREATE TABLE public.capture_submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  source_url TEXT,
  processed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.capture_submissions ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_capture_submissions_tenant_id ON public.capture_submissions(tenant_id);

CREATE POLICY "Capture submissions: anon can insert"
  ON public.capture_submissions FOR INSERT TO anon
  WITH CHECK (true);

CREATE POLICY "Capture submissions: authenticated can insert"
  ON public.capture_submissions FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Capture submissions: owner can select"
  ON public.capture_submissions FOR SELECT TO authenticated
  USING (tenant_id = public.get_tenant_id(auth.uid()));

CREATE POLICY "Capture submissions: service_role bypass"
  ON public.capture_submissions FOR ALL TO service_role
  USING (true) WITH CHECK (true);
