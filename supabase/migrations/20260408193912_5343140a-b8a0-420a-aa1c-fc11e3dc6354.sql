CREATE TABLE public.prospect_email_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_lead_id uuid REFERENCES prospect_pipeline(id) ON DELETE CASCADE,
  business_name text,
  recipient_email text NOT NULL,
  subject text,
  drip_step integer,
  status text DEFAULT 'sent',
  resend_id text,
  sent_at timestamptz DEFAULT now(),
  opened_at timestamptz,
  clicked_at timestamptz
);

ALTER TABLE public.prospect_email_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_prospect_email_log" ON public.prospect_email_log
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "service_role_all_prospect_email_log" ON public.prospect_email_log
  FOR ALL TO service_role USING (true);

CREATE INDEX idx_prospect_email_log_lead ON public.prospect_email_log(pipeline_lead_id);
CREATE INDEX idx_prospect_email_log_sent ON public.prospect_email_log(sent_at DESC);