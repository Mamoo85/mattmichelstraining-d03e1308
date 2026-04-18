CREATE TABLE IF NOT EXISTS public.apify_run_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id text NOT NULL UNIQUE,
  run_at timestamptz DEFAULT now(),
  miosha_run_id text,
  indeed_run_id text,
  linkedin_run_id text,
  miosha_done boolean DEFAULT false,
  indeed_done boolean DEFAULT false,
  linkedin_done boolean DEFAULT false,
  candidates_found int DEFAULT 0,
  alerts_sent int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.apify_run_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_apify_batches" ON public.apify_run_batches
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "admins_view_apify_batches" ON public.apify_run_batches
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_apify_batches_run_at ON public.apify_run_batches(run_at DESC);
CREATE INDEX IF NOT EXISTS idx_apify_batches_pending ON public.apify_run_batches(miosha_done, indeed_done, linkedin_done) WHERE NOT (miosha_done AND indeed_done AND linkedin_done);