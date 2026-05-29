
CREATE TABLE public.unenriched_leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  raw_email TEXT,
  raw_domain TEXT,
  source TEXT NOT NULL DEFAULT 'unknown',
  failure_reason TEXT,
  raw_payload JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.unenriched_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on unenriched_leads"
  ON public.unenriched_leads FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Tenant owners can view their unenriched leads"
  ON public.unenriched_leads FOR SELECT TO authenticated
  USING (tenant_id = public.get_tenant_id(auth.uid()));

CREATE INDEX idx_unenriched_leads_tenant ON public.unenriched_leads(tenant_id);
