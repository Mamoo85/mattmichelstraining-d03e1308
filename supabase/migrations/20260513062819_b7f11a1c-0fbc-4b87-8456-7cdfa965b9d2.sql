
CREATE TABLE IF NOT EXISTS public.cold_call_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool TEXT NOT NULL,
  source TEXT,
  company_name TEXT,
  domain TEXT,
  contact_name TEXT,
  contact_title TEXT,
  contact_phone TEXT NOT NULL,
  contact_email TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  raw_payload JSONB DEFAULT '{}'::jsonb,
  source_raw_id UUID,
  status TEXT NOT NULL DEFAULT 'queued',
  disposition TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  next_attempt_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ccq_pool_status ON public.cold_call_queue(pool, status);
CREATE INDEX IF NOT EXISTS idx_ccq_phone ON public.cold_call_queue(contact_phone);
CREATE UNIQUE INDEX IF NOT EXISTS uq_ccq_pool_phone ON public.cold_call_queue(pool, contact_phone);

ALTER TABLE public.cold_call_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY ccq_admin_read ON public.cold_call_queue
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY ccq_service ON public.cold_call_queue
  TO service_role USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.touch_cold_call_queue_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_ccq_touch ON public.cold_call_queue;
CREATE TRIGGER trg_ccq_touch BEFORE UPDATE ON public.cold_call_queue
  FOR EACH ROW EXECUTE FUNCTION public.touch_cold_call_queue_updated_at();

-- Sweep: phone-only candidates → cold_call_queue, mark them processed in raw_buyer_candidates.
WITH moved AS (
  INSERT INTO public.cold_call_queue (
    pool, source, company_name, domain, contact_name, contact_title,
    contact_phone, contact_email, city, state, zip, raw_payload, source_raw_id
  )
  SELECT pool, source, company_name, domain, contact_name, contact_title,
         contact_phone, contact_email, city, state, zip, raw_payload, id
  FROM public.raw_buyer_candidates
  WHERE enriched_at IS NULL
    AND contact_phone IS NOT NULL AND contact_phone <> ''
    AND (contact_email IS NULL OR contact_email = '')
  ON CONFLICT (pool, contact_phone) DO NOTHING
  RETURNING source_raw_id
)
UPDATE public.raw_buyer_candidates r
SET enriched_at = now(),
    rejected_reason = 'routed_to_cold_call_queue'
FROM moved m
WHERE r.id = m.source_raw_id;
