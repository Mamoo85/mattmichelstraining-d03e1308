CREATE TABLE IF NOT EXISTS public.outreach_signal_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_id uuid NOT NULL,
  play text NOT NULL,
  audience text,
  target_company text,
  sent_at timestamptz NOT NULL DEFAULT now(),
  admin_id uuid
);

CREATE INDEX IF NOT EXISTS idx_outreach_signal_log_signal ON public.outreach_signal_log(signal_id);
CREATE INDEX IF NOT EXISTS idx_outreach_signal_log_sent_at ON public.outreach_signal_log(sent_at DESC);

ALTER TABLE public.outreach_signal_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view outreach log"
  ON public.outreach_signal_log FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert outreach log"
  ON public.outreach_signal_log FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role full access outreach log"
  ON public.outreach_signal_log FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);