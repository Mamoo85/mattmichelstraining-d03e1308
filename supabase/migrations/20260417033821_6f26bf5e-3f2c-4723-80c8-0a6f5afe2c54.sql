
-- Fax Campaign System (Phaxio integration)
-- TCPA-compliant: requires public-source verification + opt-out tracking + opt-out footer

CREATE TABLE IF NOT EXISTS public.fax_opt_outs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fax_number TEXT NOT NULL UNIQUE,
  opted_out_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source TEXT,
  notes TEXT
);
ALTER TABLE public.fax_opt_outs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_fax_opt_outs" ON public.fax_opt_outs FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "admins_read_fax_opt_outs" ON public.fax_opt_outs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.fax_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  target_segment TEXT NOT NULL,
  subject TEXT,
  message_html TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  county TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ,
  total_sent INTEGER DEFAULT 0,
  total_cost NUMERIC(10,2) DEFAULT 0
);
ALTER TABLE public.fax_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_fax_campaigns" ON public.fax_campaigns FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "admins_all_fax_campaigns" ON public.fax_campaigns FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.fax_prospects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name TEXT NOT NULL,
  fax_number TEXT NOT NULL,
  contact_name TEXT,
  address TEXT,
  city TEXT,
  state TEXT DEFAULT 'MI',
  zip TEXT,
  segment TEXT NOT NULL,
  source TEXT NOT NULL,
  source_url TEXT,
  verified_public BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.fax_prospects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_fax_prospects" ON public.fax_prospects FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "admins_all_fax_prospects" ON public.fax_prospects FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE INDEX IF NOT EXISTS idx_fax_prospects_segment ON public.fax_prospects(segment);

CREATE TABLE IF NOT EXISTS public.fax_send_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id UUID REFERENCES public.fax_prospects(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES public.fax_campaigns(id) ON DELETE SET NULL,
  fax_number TEXT NOT NULL,
  business_name TEXT,
  phaxio_id TEXT,
  status TEXT NOT NULL DEFAULT 'queued',
  cost NUMERIC(8,3) DEFAULT 0.07,
  error_message TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.fax_send_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_fax_send_log" ON public.fax_send_log FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "admins_read_fax_send_log" ON public.fax_send_log FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX IF NOT EXISTS idx_fax_send_log_sent_at ON public.fax_send_log(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_fax_send_log_campaign ON public.fax_send_log(campaign_id);
