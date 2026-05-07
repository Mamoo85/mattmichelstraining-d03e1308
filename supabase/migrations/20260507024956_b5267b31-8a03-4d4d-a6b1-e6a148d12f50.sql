CREATE TABLE IF NOT EXISTS public.trial_abandonment_state (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  product TEXT,
  last_event TEXT,
  last_event_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resume_token UUID NOT NULL DEFAULT gen_random_uuid(),
  emailed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(email, product)
);

CREATE INDEX IF NOT EXISTS idx_trial_abandonment_resume_token ON public.trial_abandonment_state(resume_token);
CREATE INDEX IF NOT EXISTS idx_trial_abandonment_pending ON public.trial_abandonment_state(last_event_at) WHERE emailed_at IS NULL AND completed_at IS NULL;

ALTER TABLE public.trial_abandonment_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role full access trial_abandonment_state"
  ON public.trial_abandonment_state
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.update_trial_abandonment_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_trial_abandonment_updated_at ON public.trial_abandonment_state;
CREATE TRIGGER trg_trial_abandonment_updated_at
  BEFORE UPDATE ON public.trial_abandonment_state
  FOR EACH ROW
  EXECUTE FUNCTION public.update_trial_abandonment_updated_at();