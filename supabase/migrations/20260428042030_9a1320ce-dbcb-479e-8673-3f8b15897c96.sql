-- One-Press orchestrator run tracking
CREATE TABLE IF NOT EXISTS public.outreach_one_press_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  initiated_by UUID,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','completed','failed','cancelled')),
  stage TEXT NOT NULL DEFAULT 'queued' CHECK (stage IN ('queued','scraping','enriching','scoring','sending','completed','failed')),
  trades TEXT[] NOT NULL DEFAULT '{}',
  cities TEXT[] NOT NULL DEFAULT '{}',
  channels TEXT[] NOT NULL DEFAULT ARRAY['email']::TEXT[],
  max_prospects INTEGER NOT NULL DEFAULT 50,
  min_quality_score SMALLINT NOT NULL DEFAULT 50,
  scraped_count INTEGER NOT NULL DEFAULT 0,
  enriched_count INTEGER NOT NULL DEFAULT 0,
  scored_count INTEGER NOT NULL DEFAULT 0,
  sent_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  stage_progress JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_one_press_runs_status ON public.outreach_one_press_runs (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_one_press_runs_created ON public.outreach_one_press_runs (created_at DESC);

ALTER TABLE public.outreach_one_press_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role full access one_press_runs"
  ON public.outreach_one_press_runs FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "admins manage one_press_runs"
  ON public.outreach_one_press_runs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- updated_at trigger
CREATE TRIGGER trg_one_press_runs_updated_at
  BEFORE UPDATE ON public.outreach_one_press_runs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Realtime publication for live progress updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.outreach_one_press_runs;
ALTER TABLE public.outreach_one_press_runs REPLICA IDENTITY FULL;