-- outreach_cooldowns (DWA agent anti-collision)
CREATE TABLE IF NOT EXISTS public.outreach_cooldowns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_email TEXT NOT NULL,
  last_agent TEXT NOT NULL,
  last_contacted_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.outreach_cooldowns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access outreach_cooldowns" ON public.outreach_cooldowns;
CREATE POLICY "Service role full access outreach_cooldowns" ON public.outreach_cooldowns FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Admins can read outreach_cooldowns" ON public.outreach_cooldowns;
CREATE POLICY "Admins can read outreach_cooldowns" ON public.outreach_cooldowns FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX IF NOT EXISTS idx_outreach_cooldowns_email ON public.outreach_cooldowns(prospect_email);

-- campaign_copy_variants (DWA A/B testing)
CREATE TABLE IF NOT EXISTS public.campaign_copy_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES public.dead_lead_campaigns(id) ON DELETE CASCADE,
  variant_label TEXT NOT NULL,
  sms_body TEXT NOT NULL,
  selected BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.campaign_copy_variants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access campaign_copy_variants" ON public.campaign_copy_variants;
CREATE POLICY "Service role full access campaign_copy_variants" ON public.campaign_copy_variants FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Admins can read campaign_copy_variants" ON public.campaign_copy_variants;
CREATE POLICY "Admins can read campaign_copy_variants" ON public.campaign_copy_variants FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- contractor_lead_views RLS
DROP POLICY IF EXISTS "Service role full access contractor_lead_views" ON public.contractor_lead_views;
CREATE POLICY "Service role full access contractor_lead_views" ON public.contractor_lead_views FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Admins can read contractor_lead_views" ON public.contractor_lead_views;
CREATE POLICY "Admins can read contractor_lead_views" ON public.contractor_lead_views FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- agent_heartbeats status column
ALTER TABLE public.agent_heartbeats ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'ok';