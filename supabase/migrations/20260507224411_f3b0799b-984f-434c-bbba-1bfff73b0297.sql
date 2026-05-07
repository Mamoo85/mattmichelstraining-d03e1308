CREATE TABLE IF NOT EXISTS public.trial_reactivation_sends (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  business_name TEXT,
  trade TEXT,
  city TEXT,
  state TEXT,
  subject TEXT,
  trial_url TEXT,
  resend_id TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trial_reactivation_sends_email_sent
  ON public.trial_reactivation_sends (email, sent_at DESC);

ALTER TABLE public.trial_reactivation_sends ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all" ON public.trial_reactivation_sends;
CREATE POLICY "service_role_all" ON public.trial_reactivation_sends
  FOR ALL TO service_role USING (true) WITH CHECK (true);