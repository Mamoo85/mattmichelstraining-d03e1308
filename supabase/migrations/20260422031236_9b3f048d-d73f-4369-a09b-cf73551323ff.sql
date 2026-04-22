
-- Dossier cold-email outreach log
CREATE TABLE IF NOT EXISTS public.dossier_outreach_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_id UUID,
  signal_company TEXT NOT NULL,
  target_company TEXT NOT NULL,
  target_email TEXT,
  target_contact_name TEXT,
  status TEXT NOT NULL DEFAULT 'queued',
  sent_at TIMESTAMPTZ,
  reply_received_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dossier_outreach_target ON public.dossier_outreach_log(target_company, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dossier_outreach_signal ON public.dossier_outreach_log(signal_id);
ALTER TABLE public.dossier_outreach_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_dossier_outreach" ON public.dossier_outreach_log
  AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Cold call sheet outcomes
CREATE TABLE IF NOT EXISTS public.call_outreach_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_id UUID,
  target_company TEXT NOT NULL,
  target_phone TEXT,
  decision_maker TEXT,
  outcome TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  call_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_call_outreach_date ON public.call_outreach_log(call_date DESC);
ALTER TABLE public.call_outreach_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_call_outreach" ON public.call_outreach_log
  AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Referral kickback tracking (channel 10)
CREATE TABLE IF NOT EXISTS public.referral_kickback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id UUID,
  contractor_phone TEXT,
  referred_company TEXT,
  referred_contact_name TEXT,
  referred_contact_phone TEXT,
  referred_contact_email TEXT,
  status TEXT NOT NULL DEFAULT 'sent',
  kickback_amount_cents INT NOT NULL DEFAULT 5000,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_referral_kickback_contractor ON public.referral_kickback(contractor_id);
CREATE INDEX IF NOT EXISTS idx_referral_kickback_status ON public.referral_kickback(status, created_at DESC);
ALTER TABLE public.referral_kickback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_referral_kickback" ON public.referral_kickback
  AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
