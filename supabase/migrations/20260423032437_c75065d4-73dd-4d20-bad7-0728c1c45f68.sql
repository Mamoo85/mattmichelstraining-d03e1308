-- Mortgage Radar — Phase 2: dedup tracking, scoring boost, approval queue

-- Add tracking columns for repeat-signal scoring
ALTER TABLE public.mortgage_radar_leads
  ADD COLUMN IF NOT EXISTS signal_count INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS last_signal_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS signal_history JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_mortgage_radar_leads_last_signal ON public.mortgage_radar_leads (last_signal_at DESC);

-- Replace narrow dedup index with property-level dedup so repeat signals roll up
DROP INDEX IF EXISTS idx_mortgage_radar_leads_dedup;
CREATE UNIQUE INDEX IF NOT EXISTS idx_mortgage_radar_leads_property_dedup
  ON public.mortgage_radar_leads (LOWER(COALESCE(address,'')), COALESCE(zip,''))
  WHERE address IS NOT NULL AND length(address) > 0;

-- Outreach approval queue — every SMS/email to a prospect must be LO-approved before send
CREATE TABLE IF NOT EXISTS public.mortgage_radar_outreach (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.mortgage_radar_leads(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.mortgage_radar_clients(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('sms','email','call_note')),
  draft_subject TEXT,
  draft_body TEXT NOT NULL,
  approved_body TEXT,
  status TEXT NOT NULL DEFAULT 'pending_approval' CHECK (status IN ('pending_approval','approved','sent','rejected','failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  send_error TEXT
);

CREATE INDEX IF NOT EXISTS idx_mr_outreach_client_status ON public.mortgage_radar_outreach (client_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mr_outreach_lead ON public.mortgage_radar_outreach (lead_id);

ALTER TABLE public.mortgage_radar_outreach ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role bypass mr_outreach"
  ON public.mortgage_radar_outreach FOR ALL
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "admins read mr_outreach"
  ON public.mortgage_radar_outreach FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION public.touch_mortgage_radar_leads()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_mortgage_radar_leads ON public.mortgage_radar_leads;
CREATE TRIGGER trg_touch_mortgage_radar_leads
  BEFORE UPDATE ON public.mortgage_radar_leads
  FOR EACH ROW EXECUTE FUNCTION public.touch_mortgage_radar_leads();