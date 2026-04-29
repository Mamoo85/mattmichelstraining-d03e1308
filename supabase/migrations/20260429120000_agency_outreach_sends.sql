CREATE TABLE IF NOT EXISTS public.agency_outreach_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_name text NOT NULL,
  agency_email text NOT NULL,
  candidate_count integer DEFAULT 0,
  vertical text DEFAULT 'industrial',
  subject text,
  resend_id text,
  sent_at timestamptz DEFAULT now()
);

ALTER TABLE public.agency_outreach_sends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON public.agency_outreach_sends
  FOR ALL USING (auth.role() = 'service_role');
