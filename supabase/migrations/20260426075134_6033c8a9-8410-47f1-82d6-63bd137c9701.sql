CREATE TABLE IF NOT EXISTS public.email_campaigns (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  audience_type text,
  subject text NOT NULL,
  message_html text NOT NULL,
  prospect_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
  prospect_count integer NOT NULL DEFAULT 0,
  sent_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);

ALTER TABLE public.email_campaigns ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'email_campaigns' AND policyname = 'Admins manage email_campaigns'
  ) THEN
    CREATE POLICY "Admins manage email_campaigns"
    ON public.email_campaigns
    FOR ALL
    TO authenticated
    USING (public.has_role(auth.uid(), 'admin'))
    WITH CHECK (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'email_campaigns' AND policyname = 'Service role manages email_campaigns'
  ) THEN
    CREATE POLICY "Service role manages email_campaigns"
    ON public.email_campaigns
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
  END IF;
END $$;

ALTER TABLE public.postcard_campaigns
ADD COLUMN IF NOT EXISTS prospect_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[];

ALTER TABLE public.fax_campaigns
ADD COLUMN IF NOT EXISTS prospect_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[];

CREATE INDEX IF NOT EXISTS idx_email_campaigns_created_at ON public.email_campaigns(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_campaigns_status ON public.email_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_email_campaigns_prospect_ids ON public.email_campaigns USING gin (prospect_ids);
CREATE INDEX IF NOT EXISTS idx_postcard_campaigns_prospect_ids ON public.postcard_campaigns USING gin (prospect_ids);
CREATE INDEX IF NOT EXISTS idx_fax_campaigns_prospect_ids ON public.fax_campaigns USING gin (prospect_ids);