
-- Create hire_REDACTED table for tracking which candidates were sent to which clients
CREATE TABLE IF NOT EXISTS public.hire_REDACTED (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL,
  candidate_id UUID NOT NULL,
  alerted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  alert_type TEXT NOT NULL DEFAULT 'email',
  UNIQUE (client_id, candidate_id)
);

ALTER TABLE public.hire_REDACTED ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on hire_REDACTED"
  ON public.hire_REDACTED
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE INDEX idx_hacc_client ON public.hire_REDACTED (client_id);
CREATE INDEX idx_hacc_candidate ON public.hire_REDACTED (candidate_id);
