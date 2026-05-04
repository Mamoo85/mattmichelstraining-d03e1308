CREATE INDEX IF NOT EXISTS idx_mortgage_radar_leads_pipeline_stage
  ON public.mortgage_radar_leads (pipeline_stage)
  WHERE pipeline_stage IS NOT NULL;

ALTER TABLE public.mortgage_radar_leads
  ALTER COLUMN pipeline_stage SET DEFAULT 'active';