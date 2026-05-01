-- v4 Phase 2: Compliance audit, QBR queue, add-on marketplace, roofing vertical

-- §10 Compliance Auto-Audit
CREATE TABLE IF NOT EXISTS public.compliance_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  channel TEXT NOT NULL, -- sms, email, fax, postcard
  campaign_id TEXT,
  campaign_table TEXT,
  violation_type TEXT NOT NULL, -- tcpa_quiet_hours, can_spam_no_unsubscribe, spam_complaint_threshold, etc
  severity TEXT NOT NULL DEFAULT 'warning', -- info, warning, critical
  details JSONB DEFAULT '{}'::jsonb,
  auto_disabled BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.compliance_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role bypass compliance" ON public.compliance_audit_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "admins read compliance" ON public.compliance_audit_log
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_compliance_audit_unresolved
  ON public.compliance_audit_log(created_at DESC)
  WHERE resolved_at IS NULL;

-- §2 QBR Queue
CREATE TABLE IF NOT EXISTS public.qbr_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_email TEXT NOT NULL,
  client_name TEXT,
  product TEXT NOT NULL,
  quarter TEXT NOT NULL, -- e.g. '2026-Q1'
  pdf_url TEXT,
  pdf_generated_at TIMESTAMPTZ,
  metrics JSONB DEFAULT '{}'::jsonb, -- leads, calls, jobs, revenue
  status TEXT NOT NULL DEFAULT 'pending_review', -- pending_review, approved, sent, auto_send_eligible
  approved_at TIMESTAMPTZ,
  approved_by UUID,
  sent_at TIMESTAMPTZ,
  manual_review_count INT DEFAULT 0, -- after 4, eligible for auto-send
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.qbr_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role bypass qbr" ON public.qbr_queue
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "admins manage qbr" ON public.qbr_queue
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_qbr_queue_status
  ON public.qbr_queue(status, created_at DESC);

-- §5 Add-On Marketplace catalog
CREATE TABLE IF NOT EXISTS public.addon_catalog (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE, -- 'siteradar', 'mortgage_radar', 'techalert', etc
  name TEXT NOT NULL,
  pitch TEXT NOT NULL,
  monthly_price_cents INT NOT NULL,
  stripe_price_lookup_key TEXT, -- not used (we use inline price_data) but stored for ref
  base_products TEXT[] DEFAULT '{}', -- products this can attach to
  active BOOLEAN DEFAULT true,
  display_order INT DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.addon_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role bypass addons" ON public.addon_catalog
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "anyone reads active addons" ON public.addon_catalog
  FOR SELECT TO anon, authenticated
  USING (active = true);

-- Seed catalog
INSERT INTO public.addon_catalog (slug, name, pitch, monthly_price_cents, base_products, display_order) VALUES
  ('siteradar', 'SiteRadar', 'See exactly which contractors visit your website—and get notified when hot prospects return.', 4900, ARRAY['fielddesk','contractor_leads','techalert'], 10),
  ('mortgage_radar', 'Mortgage Radar', 'Daily list of new homeowners in your service area, scored & ready for outreach.', 14900, ARRAY['fielddesk','contractor_leads'], 20),
  ('techalert', 'TechAlert', 'Get alerted the moment a competitor posts a hiring listing for your trade.', 7900, ARRAY['fielddesk','contractor_leads','siteradar'], 30),
  ('missed_call_catch', 'Missed-Call Catch', 'Auto-text every missed caller within 30 seconds. Captures 60% of lost leads.', 9900, ARRAY['fielddesk','contractor_leads','techalert'], 40),
  ('ai_phone_answering', 'AI Phone Answering', '24/7 AI receptionist that books jobs, answers FAQs, and texts you the transcript.', 19900, ARRAY['fielddesk','contractor_leads'], 50),
  ('reputation_dashboard', 'AI Reputation Dashboard', 'Auto-request reviews from completed jobs. Reply to bad reviews with AI-drafted responses.', 7900, ARRAY['fielddesk','contractor_leads','techalert'], 60)
ON CONFLICT (slug) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.addon_pitches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_email TEXT NOT NULL,
  addon_slug TEXT NOT NULL,
  pitched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  outcome TEXT, -- 'subscribed', 'declined', 'pending'
  stripe_session_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.addon_pitches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role bypass addon_pitches" ON public.addon_pitches
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "users see own pitches" ON public.addon_pitches
  FOR SELECT TO authenticated
  USING (
    client_email = (auth.jwt() ->> 'email')
    OR public.has_role(auth.uid(), 'admin')
  );

-- §7-9 Roofing vertical: prospects table mirrors contractor_leads pattern
CREATE TABLE IF NOT EXISTS public.roofing_prospects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_name TEXT NOT NULL,
  city TEXT,
  state TEXT DEFAULT 'MI',
  estimated_revenue_band TEXT, -- '<1M', '1-5M', '5-20M', '20M+'
  permit_count_90d INT DEFAULT 0,
  largest_permit_value_cents BIGINT,
  owner_name TEXT,
  owner_email TEXT,
  owner_phone TEXT,
  website TEXT,
  signal_source TEXT, -- 'bseed', 'apollo', 'google_places'
  signals JSONB DEFAULT '{}'::jsonb,
  outreach_status TEXT DEFAULT 'new',
  enriched_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.roofing_prospects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role bypass roofing" ON public.roofing_prospects
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "admins read roofing" ON public.roofing_prospects
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_roofing_prospects_status
  ON public.roofing_prospects(outreach_status, created_at DESC);
