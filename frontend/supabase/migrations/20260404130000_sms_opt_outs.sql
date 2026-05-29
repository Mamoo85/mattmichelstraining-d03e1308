-- SMS opt-out registry: global table for all Twilio opt-outs
-- TCPA requires honoring STOP replies immediately across all products.
-- Twilio auto-handles opt-outs at the carrier level, but M2 edge functions
-- must also check this table before sending to avoid sequencing stale numbers.

CREATE TABLE IF NOT EXISTS public.sms_opt_outs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone         text NOT NULL UNIQUE,           -- E.164 format e.g. +13135550100
  opted_out_at  timestamptz NOT NULL DEFAULT now(),
  source        text DEFAULT 'twilio_stop',     -- twilio_stop | manual | compliance_block
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sms_opt_outs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public.sms_opt_outs FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Index for fast phone lookups before every send
CREATE INDEX IF NOT EXISTS idx_sms_opt_outs_phone ON public.sms_opt_outs (phone);

-- Compliance blocks audit log
CREATE TABLE IF NOT EXISTS public.compliance_blocks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone       text,
  product     text,
  sequence_id uuid,
  reason      text NOT NULL,
  blocked_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.compliance_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public.compliance_blocks FOR ALL TO service_role USING (true) WITH CHECK (true);
