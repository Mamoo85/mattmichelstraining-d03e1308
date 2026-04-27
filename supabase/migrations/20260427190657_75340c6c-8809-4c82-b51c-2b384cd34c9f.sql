CREATE TABLE IF NOT EXISTS public.contractor_outreach_prospects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name text NOT NULL,
  owner_name text,
  trade text NOT NULL,
  city text,
  state text DEFAULT 'MI',
  email text,
  email_verified boolean DEFAULT false,
  phone text,
  website text,
  source text,
  scraped_at timestamptz DEFAULT now(),
  enriched_at timestamptz,
  enrichment_trace jsonb DEFAULT '[]'::jsonb,
  last_emailed_at timestamptz,
  last_smsed_at timestamptz,
  email_send_count int NOT NULL DEFAULT 0,
  reply_status text,
  consent_for_sms boolean NOT NULL DEFAULT false,
  consent_source text,
  consent_timestamp timestamptz,
  unsubscribed_at timestamptz,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_outreach_prospects_email_unique
  ON public.contractor_outreach_prospects(lower(email))
  WHERE email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_outreach_prospects_trade_city
  ON public.contractor_outreach_prospects(trade, city);

CREATE INDEX IF NOT EXISTS idx_outreach_prospects_unsub
  ON public.contractor_outreach_prospects(unsubscribed_at) WHERE unsubscribed_at IS NULL;

ALTER TABLE public.contractor_outreach_prospects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role full access outreach_prospects"
  ON public.contractor_outreach_prospects FOR ALL
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "admins manage outreach_prospects"
  ON public.contractor_outreach_prospects FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_outreach_prospects_updated_at
  BEFORE UPDATE ON public.contractor_outreach_prospects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();