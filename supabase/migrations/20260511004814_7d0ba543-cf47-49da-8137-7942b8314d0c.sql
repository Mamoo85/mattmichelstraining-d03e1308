CREATE TABLE IF NOT EXISTS public.scanner_source_runs (
  id BIGSERIAL PRIMARY KEY,
  source TEXT NOT NULL,
  product TEXT NOT NULL,
  ok BOOLEAN NOT NULL,
  rows_returned INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  ran_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scanner_source_runs_source_ran_at
  ON public.scanner_source_runs (source, ran_at DESC);
CREATE INDEX IF NOT EXISTS idx_scanner_source_runs_product_ran_at
  ON public.scanner_source_runs (product, ran_at DESC);

ALTER TABLE public.scanner_source_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_full_runs" ON public.scanner_source_runs;
CREATE POLICY "service_role_full_runs" ON public.scanner_source_runs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "admins_read_runs" ON public.scanner_source_runs;
CREATE POLICY "admins_read_runs" ON public.scanner_source_runs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));