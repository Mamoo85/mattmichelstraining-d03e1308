
CREATE TABLE IF NOT EXISTS public.staffing_agency_raw_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_name TEXT NOT NULL,
  website TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  state TEXT DEFAULT 'MI',
  source TEXT NOT NULL,
  dedupe_key TEXT NOT NULL UNIQUE,
  enrichment_status TEXT NOT NULL DEFAULT 'pending', -- pending | enriched | failed | duplicate
  enrichment_attempts INT NOT NULL DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  resolved_email TEXT,
  resolved_via TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_staffing_raw_queue_status ON public.staffing_agency_raw_queue(enrichment_status, created_at);

ALTER TABLE public.staffing_agency_raw_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_staffing_raw_queue" ON public.staffing_agency_raw_queue
  FOR ALL TO service_role USING (true) WITH CHECK (true);
