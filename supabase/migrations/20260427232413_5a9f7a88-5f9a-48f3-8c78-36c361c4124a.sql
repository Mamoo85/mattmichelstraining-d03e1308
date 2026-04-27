-- 1. Enrichment columns on industrial_supply_buyers
ALTER TABLE public.industrial_supply_buyers
  ADD COLUMN IF NOT EXISTS fax text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS state text DEFAULT 'MI',
  ADD COLUMN IF NOT EXISTS zip text,
  ADD COLUMN IF NOT EXISTS website text,
  ADD COLUMN IF NOT EXISTS enrichment_status text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS enriched_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_outreach_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_isb_enrichment_status ON public.industrial_supply_buyers (enrichment_status);

-- 2. Multi-channel outreach log
CREATE TABLE IF NOT EXISTS public.signal_outreach_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_id uuid NOT NULL,
  buyer_id uuid REFERENCES public.industrial_supply_buyers(id) ON DELETE SET NULL,
  buyer_company text,
  channel text NOT NULL CHECK (channel IN ('email','sms','fax','postcard')),
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sent','skipped','failed','cancelled','replied')),
  cost_cents integer NOT NULL DEFAULT 0,
  external_id text,
  draft_id uuid,
  error text,
  meta jsonb DEFAULT '{}'::jsonb,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sol_signal ON public.signal_outreach_log (signal_id, channel);
CREATE INDEX IF NOT EXISTS idx_sol_buyer_channel_recent ON public.signal_outreach_log (buyer_id, channel, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sol_channel_day ON public.signal_outreach_log (channel, created_at DESC);

ALTER TABLE public.signal_outreach_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role full access sol" ON public.signal_outreach_log;
CREATE POLICY "service_role full access sol" ON public.signal_outreach_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "admins read sol" ON public.signal_outreach_log;
CREATE POLICY "admins read sol" ON public.signal_outreach_log
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 3. SMS ghost-delay drafts (mirrors email_reply_drafts pattern)
CREATE TABLE IF NOT EXISTS public.sms_outreach_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  to_phone text NOT NULL,
  body text NOT NULL,
  category text NOT NULL DEFAULT 'signal_outreach',
  signal_id uuid,
  buyer_id uuid,
  send_after timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','cancelled','failed')),
  external_id text,
  error text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sod_pending_due ON public.sms_outreach_drafts (status, send_after) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_sod_signal ON public.sms_outreach_drafts (signal_id);

ALTER TABLE public.sms_outreach_drafts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role full access sod" ON public.sms_outreach_drafts;
CREATE POLICY "service_role full access sod" ON public.sms_outreach_drafts
  FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "admins read sod" ON public.sms_outreach_drafts;
CREATE POLICY "admins read sod" ON public.sms_outreach_drafts
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));