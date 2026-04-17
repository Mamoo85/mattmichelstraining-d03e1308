-- DOL labor stats snapshots — historical Detroit-MSA trade shortage signals
CREATE TABLE IF NOT EXISTS public.dol_labor_snapshots (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  area_code   TEXT NOT NULL,
  area_name   TEXT,
  rows        JSONB NOT NULL DEFAULT '[]'::jsonb,
  shortage_signals JSONB NOT NULL DEFAULT '[]'::jsonb,
  duration_ms INTEGER
);

ALTER TABLE public.dol_labor_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service role full access dol snapshots"
  ON public.dol_labor_snapshots
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "admins read dol snapshots"
  ON public.dol_labor_snapshots
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS dol_labor_snapshots_created_idx
  ON public.dol_labor_snapshots(created_at DESC);