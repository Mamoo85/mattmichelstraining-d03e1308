
-- Create hire_alert_client_candidates table for tracking which candidates were sent to which clients
CREATE TABLE IF NOT EXISTS public.hire_alert_client_candidates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL,
  candidate_id UUID NOT NULL,
  alerted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  alert_type TEXT NOT NULL DEFAULT 'email',
  UNIQUE (client_id, candidate_id)
);

ALTER TABLE public.hire_alert_client_candidates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on hire_alert_client_candidates"
  ON public.hire_alert_client_candidates
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE INDEX idx_hacc_client ON public.hire_alert_client_candidates (client_id);
CREATE INDEX idx_hacc_candidate ON public.hire_alert_client_candidates (candidate_id);
