ALTER TABLE public.techalert_prospect_targets
  ADD COLUMN IF NOT EXISTS employee_count   INT,
  ADD COLUMN IF NOT EXISTS owner_name       TEXT,
  ADD COLUMN IF NOT EXISTS owner_email      TEXT,
  ADD COLUMN IF NOT EXISTS owner_phone      TEXT,
  ADD COLUMN IF NOT EXISTS owner_linkedin   TEXT,
  ADD COLUMN IF NOT EXISTS enriched_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS outreach_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS outreach_status  TEXT;

CREATE INDEX IF NOT EXISTS idx_techalert_targets_enrich
  ON public.techalert_prospect_targets (enriched_at, status)
  WHERE enriched_at IS NULL AND status = 'new';

CREATE INDEX IF NOT EXISTS idx_techalert_targets_outreach
  ON public.techalert_prospect_targets (outreach_sent_at, enriched_at, score)
  WHERE outreach_sent_at IS NULL AND enriched_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.techalert_hunter_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ran_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  scanned INT NOT NULL DEFAULT 0,
  inserted INT NOT NULL DEFAULT 0,
  updated INT NOT NULL DEFAULT 0,
  duration_ms INT,
  signals JSONB,
  alert_sent BOOLEAN NOT NULL DEFAULT false,
  notes TEXT
);
ALTER TABLE public.techalert_hunter_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all" ON public.techalert_hunter_runs;
CREATE POLICY "service_role_all" ON public.techalert_hunter_runs FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "admin_read_runs" ON public.techalert_hunter_runs;
CREATE POLICY "admin_read_runs" ON public.techalert_hunter_runs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX IF NOT EXISTS idx_techalert_hunter_runs_ran_at ON public.techalert_hunter_runs (ran_at DESC);