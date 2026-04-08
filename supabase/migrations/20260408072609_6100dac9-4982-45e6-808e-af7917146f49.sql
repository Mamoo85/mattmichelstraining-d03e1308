-- Add RLS policies for authenticated users on prospect_pipeline
CREATE POLICY "authenticated_all" ON public.prospect_pipeline FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Add drip tracking columns
ALTER TABLE public.prospect_pipeline
  ADD COLUMN IF NOT EXISTS drip_step integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS drip_status text DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS last_drip_at timestamptz,
  ADD COLUMN IF NOT EXISTS drip_subject text,
  ADD COLUMN IF NOT EXISTS drip_body text,
  ADD COLUMN IF NOT EXISTS gap_analysis text,
  ADD COLUMN IF NOT EXISTS has_facebook boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_instagram boolean DEFAULT false;