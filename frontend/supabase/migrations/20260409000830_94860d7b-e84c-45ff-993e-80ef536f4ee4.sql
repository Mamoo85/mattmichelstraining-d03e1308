ALTER TABLE public.prospect_pipeline
  ADD COLUMN IF NOT EXISTS core_service text,
  ADD COLUMN IF NOT EXISTS specific_site_flaw text,
  ADD COLUMN IF NOT EXISTS recent_activity text;