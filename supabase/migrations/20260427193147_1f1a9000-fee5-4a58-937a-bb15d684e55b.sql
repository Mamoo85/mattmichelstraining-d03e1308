-- 1. Audit log: every outreach event logged
CREATE TABLE public.contractor_outreach_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id uuid REFERENCES public.contractor_outreach_prospects(id) ON DELETE CASCADE,
  lead_id uuid,
  channel text NOT NULL CHECK (channel IN ('email','sms')),
  event text NOT NULL CHECK (event IN ('sent','opened','clicked','replied','unsubscribed','suppressed','consent_granted','consent_revoked','quiet_hours_blocked','daily_cap_blocked','bounce')),
  reason text,
  ip_address text,
  user_agent text,
  actor text DEFAULT 'system',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_outreach_audit_prospect ON public.contractor_outreach_audit_log(prospect_id, created_at DESC);
CREATE INDEX idx_outreach_audit_channel_event ON public.contractor_outreach_audit_log(channel, event, created_at DESC);
CREATE INDEX idx_outreach_audit_created ON public.contractor_outreach_audit_log(created_at DESC);

ALTER TABLE public.contractor_outreach_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role full access" ON public.contractor_outreach_audit_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "admins read audit log" ON public.contractor_outreach_audit_log
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 2. Global suppression list (do-not-contact)
CREATE TABLE public.contractor_outreach_suppression (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact text NOT NULL,
  contact_type text NOT NULL CHECK (contact_type IN ('email','phone')),
  reason text,
  source text NOT NULL CHECK (source IN ('unsubscribe_link','bounce','complaint','manual','competitor_block','sms_stop','spam_report')),
  added_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT outreach_suppression_unique UNIQUE (contact, contact_type)
);

CREATE INDEX idx_outreach_suppression_contact ON public.contractor_outreach_suppression(contact);

ALTER TABLE public.contractor_outreach_suppression ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role full access" ON public.contractor_outreach_suppression
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "admins full access suppression" ON public.contractor_outreach_suppression
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 3. Priority flag on territories
ALTER TABLE public.contractor_lead_sites
  ADD COLUMN IF NOT EXISTS is_priority boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_contractor_lead_sites_priority
  ON public.contractor_lead_sites(is_priority) WHERE is_priority = true;