-- ── contractor_welcome_log: idempotency + delivery tracking for welcome SMS ───
CREATE TABLE IF NOT EXISTS public.contractor_welcome_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contractor_id UUID NOT NULL,
  message_index SMALLINT NOT NULL CHECK (message_index >= 0 AND message_index <= 5),
  status TEXT NOT NULL DEFAULT 'queued',
    -- queued | sent | delivered | failed | skipped
  twilio_sid TEXT,
  twilio_status TEXT,
    -- Twilio delivery callback: queued | sending | sent | delivered | undelivered | failed
  twilio_error_code TEXT,
  recipient_phone TEXT,
  body_preview TEXT,
  error_message TEXT,
  attempted_by TEXT NOT NULL DEFAULT 'system',
    -- 'system' | 'admin_retry' | 'webhook'
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Idempotency: one successful send per (contractor, slot). Failed/skipped rows
-- can repeat (we filter by status in the partial unique index below).
CREATE UNIQUE INDEX IF NOT EXISTS contractor_welcome_log_unique_success
  ON public.contractor_welcome_log (contractor_id, message_index)
  WHERE status IN ('queued','sent','delivered');

CREATE INDEX IF NOT EXISTS contractor_welcome_log_contractor_idx
  ON public.contractor_welcome_log (contractor_id, created_at DESC);

ALTER TABLE public.contractor_welcome_log ENABLE ROW LEVEL SECURITY;

-- Service role bypass (edge functions) — implicit with service_role, but
-- declare explicitly so admin policies don't block backend writes.
CREATE POLICY "service_role_all_welcome_log"
  ON public.contractor_welcome_log
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "admins_read_welcome_log"
  ON public.contractor_welcome_log
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));


-- ── contractor_provisioning_audit: which Stripe event provisioned what ────────
CREATE TABLE IF NOT EXISTS public.contractor_provisioning_audit (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contractor_id UUID,
    -- nullable: when meta.contractor_id is missing or row not found yet
  contractor_email TEXT,
  business_name TEXT,
  stripe_event_id TEXT,
  stripe_event_type TEXT,
  stripe_session_id TEXT,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  outcome TEXT NOT NULL,
    -- 'provisioned' | 'failed' | 'skipped_no_contractor_id'
    --  | 'skipped_already_active' | 'payment_pending' | 'manual_insert'
  reason TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Same Stripe event should not double-provision the same contractor
CREATE UNIQUE INDEX IF NOT EXISTS contractor_provisioning_audit_event_unique
  ON public.contractor_provisioning_audit (stripe_event_id, contractor_id)
  WHERE stripe_event_id IS NOT NULL AND contractor_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS contractor_provisioning_audit_contractor_idx
  ON public.contractor_provisioning_audit (contractor_id, created_at DESC);

CREATE INDEX IF NOT EXISTS contractor_provisioning_audit_email_idx
  ON public.contractor_provisioning_audit (contractor_email, created_at DESC);

ALTER TABLE public.contractor_provisioning_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_provisioning_audit"
  ON public.contractor_provisioning_audit
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "admins_read_provisioning_audit"
  ON public.contractor_provisioning_audit
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));


-- ── updated_at trigger for welcome log ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.touch_contractor_welcome_log()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS contractor_welcome_log_touch ON public.contractor_welcome_log;
CREATE TRIGGER contractor_welcome_log_touch
  BEFORE UPDATE ON public.contractor_welcome_log
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_contractor_welcome_log();