
CREATE TABLE public.marketing_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  first_name TEXT,
  source TEXT NOT NULL DEFAULT 'AI_Honeypot',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT marketing_leads_email_source_unique UNIQUE (email, source)
);

ALTER TABLE public.marketing_leads ENABLE ROW LEVEL SECURITY;

-- Allow edge functions (service_role) to insert/update
CREATE POLICY "Service role full access on marketing_leads"
  ON public.marketing_leads
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Allow admins to read
CREATE POLICY "Admins can read marketing_leads"
  ON public.marketing_leads
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
