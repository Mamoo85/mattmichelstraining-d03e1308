-- Wave 1 foundation: source_health tracking table
CREATE TABLE IF NOT EXISTS public.source_health (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_name TEXT NOT NULL UNIQUE,
  product TEXT,
  source_type TEXT,
  last_run_at TIMESTAMPTZ,
  last_yield INT DEFAULT 0,
  total_runs INT NOT NULL DEFAULT 0,
  consecutive_zero_days INT NOT NULL DEFAULT 0,
  paused BOOLEAN NOT NULL DEFAULT FALSE,
  paused_reason TEXT,
  last_error TEXT,
  daily_cap INT NOT NULL DEFAULT 200,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_source_health_paused ON public.source_health(paused) WHERE paused = false;
CREATE INDEX IF NOT EXISTS idx_source_health_product ON public.source_health(product);

ALTER TABLE public.source_health ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role bypass source_health"
  ON public.source_health FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "admins read source_health"
  ON public.source_health FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_source_health_updated_at
  BEFORE UPDATE ON public.source_health
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();