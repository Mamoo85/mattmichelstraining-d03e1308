-- Fax campaigns: audience, county, error tracking
ALTER TABLE public.fax_campaigns
  ADD COLUMN IF NOT EXISTS audience_type text,
  ADD COLUMN IF NOT EXISTS last_error text,
  ADD COLUMN IF NOT EXISTS phaxio_batch_id text;

-- Fax prospects: audience, county, sent tracking
ALTER TABLE public.fax_prospects
  ADD COLUMN IF NOT EXISTS audience_type text,
  ADD COLUMN IF NOT EXISTS county text,
  ADD COLUMN IF NOT EXISTS fax_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS fax_send_id text;

CREATE INDEX IF NOT EXISTS idx_fax_prospects_audience ON public.fax_prospects(audience_type);
CREATE INDEX IF NOT EXISTS idx_fax_prospects_county ON public.fax_prospects(county);
CREATE INDEX IF NOT EXISTS idx_fax_prospects_sent ON public.fax_prospects(fax_sent_at);

-- Fax send log: delivery tracking
ALTER TABLE public.fax_send_log
  ADD COLUMN IF NOT EXISTS audience_type text,
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS failed_at timestamptz,
  ADD COLUMN IF NOT EXISTS phaxio_status text;

CREATE INDEX IF NOT EXISTS idx_fax_send_log_campaign ON public.fax_send_log(campaign_id);
CREATE INDEX IF NOT EXISTS idx_fax_send_log_status ON public.fax_send_log(status);

-- Fax conversions: QR scans + signups from fax landing page
CREATE TABLE IF NOT EXISTS public.fax_conversions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES public.fax_campaigns(id) ON DELETE SET NULL,
  prospect_id uuid REFERENCES public.fax_prospects(id) ON DELETE SET NULL,
  audience_type text,
  product_key text,
  event text NOT NULL,
  utm_campaign text,
  user_agent text,
  referrer text,
  email text,
  business_name text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fax_conversions_campaign ON public.fax_conversions(campaign_id);
CREATE INDEX IF NOT EXISTS idx_fax_conversions_event ON public.fax_conversions(event);
CREATE INDEX IF NOT EXISTS idx_fax_conversions_audience ON public.fax_conversions(audience_type);

ALTER TABLE public.fax_conversions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_fax_conversions"
  ON public.fax_conversions
  TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "anon_insert_fax_conversions"
  ON public.fax_conversions
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "admins_select_fax_conversions"
  ON public.fax_conversions
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));