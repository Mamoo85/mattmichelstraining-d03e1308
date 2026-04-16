
-- 1. sms_opt_outs (TCPA compliance)
CREATE TABLE IF NOT EXISTS public.sms_opt_outs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL UNIQUE,
  opted_out_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source TEXT DEFAULT 'user'
);
ALTER TABLE public.sms_opt_outs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on sms_opt_outs" ON public.sms_opt_outs FOR ALL USING (true) WITH CHECK (true);

-- 2. compliance_blocks (audit trail)
CREATE TABLE IF NOT EXISTS public.compliance_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL,
  product TEXT,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.compliance_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on compliance_blocks" ON public.compliance_blocks FOR ALL USING (true) WITH CHECK (true);

-- 3. system_comms_log (unified SMS+email timeline)
CREATE TABLE IF NOT EXISTS public.system_comms_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel TEXT NOT NULL DEFAULT 'sms',
  product TEXT,
  recipient TEXT NOT NULL,
  body_preview TEXT,
  status TEXT NOT NULL DEFAULT 'sent',
  error_message TEXT,
  provider_id TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.system_comms_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on system_comms_log" ON public.system_comms_log FOR ALL USING (true) WITH CHECK (true);

-- Trigger: sync email_send_log inserts to system_comms_log
CREATE OR REPLACE FUNCTION public.sync_email_to_comms_log()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.system_comms_log (channel, product, recipient, body_preview, status, provider_id, metadata)
  VALUES (
    'email',
    NEW.product,
    NEW.recipient_email,
    LEFT(COALESCE(NEW.subject, ''), 200),
    COALESCE(NEW.status, 'sent'),
    NEW.resend_id,
    jsonb_build_object('subject', NEW.subject)
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block email execution if comms log fails
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_email_to_comms_log
AFTER INSERT ON public.email_send_log
FOR EACH ROW EXECUTE FUNCTION public.sync_email_to_comms_log();

-- 4. contractor_lead_purchases
CREATE TABLE IF NOT EXISTS public.contractor_lead_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.contractor_leads(id),
  contractor_id TEXT NOT NULL,
  contractor_email TEXT,
  stripe_session_id TEXT,
  amount_cents INTEGER NOT NULL DEFAULT 5000,
  trade TEXT,
  city TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.contractor_lead_purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on contractor_lead_purchases" ON public.contractor_lead_purchases FOR ALL USING (true) WITH CHECK (true);

-- 5. contractor_lead_views (FOMO engine)
CREATE TABLE IF NOT EXISTS public.contractor_lead_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id TEXT NOT NULL,
  lead_id UUID REFERENCES public.contractor_leads(id),
  reason TEXT,
  trade TEXT,
  city TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.contractor_lead_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on contractor_lead_views" ON public.contractor_lead_views FOR ALL USING (true) WITH CHECK (true);

-- 6. Add missing columns to contractor_leads
ALTER TABLE public.contractor_leads ADD COLUMN IF NOT EXISTS checkout_locked_by TEXT;
ALTER TABLE public.contractor_leads ADD COLUMN IF NOT EXISTS lock_expires_at TIMESTAMPTZ;
ALTER TABLE public.contractor_leads ADD COLUMN IF NOT EXISTS payment_session_id TEXT;
ALTER TABLE public.contractor_leads ADD COLUMN IF NOT EXISTS paid_by_contractor_id TEXT;
ALTER TABLE public.contractor_leads ADD COLUMN IF NOT EXISTS payment_amount_cents INTEGER;
ALTER TABLE public.contractor_leads ADD COLUMN IF NOT EXISTS is_aged BOOLEAN NOT NULL DEFAULT false;

-- Index for aged lead queries
CREATE INDEX IF NOT EXISTS idx_contractor_leads_is_aged ON public.contractor_leads (is_aged) WHERE is_aged = false;
CREATE INDEX IF NOT EXISTS idx_contractor_leads_status ON public.contractor_leads (status);
