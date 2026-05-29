
-- Track trial emails sent to prevent duplicates
CREATE TABLE IF NOT EXISTS public.trial_emails_sent (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  email_type text NOT NULL DEFAULT 'day6_conversion',
  sent_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, email_type)
);

ALTER TABLE public.trial_emails_sent ENABLE ROW LEVEL SECURITY;

-- Only service role and admins can access
CREATE POLICY "Service role manages trial emails"
  ON public.trial_emails_sent FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Admins can view trial emails"
  ON public.trial_emails_sent FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
