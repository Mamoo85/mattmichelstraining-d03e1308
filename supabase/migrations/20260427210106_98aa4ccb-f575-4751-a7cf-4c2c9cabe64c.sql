ALTER TABLE public.outreach_leads
  ADD COLUMN IF NOT EXISTS enriched_email text,
  ADD COLUMN IF NOT EXISTS enriched_email_source text,
  ADD COLUMN IF NOT EXISTS enriched_email_confidence int,
  ADD COLUMN IF NOT EXISTS enriched_email_at timestamptz,
  ADD COLUMN IF NOT EXISTS enrichment_trace jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS gmail_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS gmail_message_id text;

CREATE INDEX IF NOT EXISTS idx_outreach_leads_enriched_email
  ON public.outreach_leads (enriched_email) WHERE enriched_email IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.outreach_gmail_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  outreach_lead_id uuid REFERENCES public.outreach_leads(id) ON DELETE CASCADE,
  sender_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  sender_email text,
  to_email text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  gmail_message_id text,
  status text NOT NULL,
  error text,
  sent_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_outreach_gmail_sends_lead
  ON public.outreach_gmail_sends (outreach_lead_id);
CREATE INDEX IF NOT EXISTS idx_outreach_gmail_sends_sent_at
  ON public.outreach_gmail_sends (sent_at DESC);

ALTER TABLE public.outreach_gmail_sends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role full access outreach_gmail_sends"
  ON public.outreach_gmail_sends FOR ALL
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "admins can view outreach_gmail_sends"
  ON public.outreach_gmail_sends FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));