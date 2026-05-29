
-- postcard_prospects: scraped LARA business registrations
CREATE TABLE public.postcard_prospects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_name TEXT NOT NULL,
  license_types TEXT[] DEFAULT '{}',
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT DEFAULT 'MI',
  zip TEXT,
  county TEXT,
  owner_name TEXT,
  phone TEXT,
  email TEXT,
  license_count INTEGER DEFAULT 0,
  newest_license_date DATE,
  source TEXT DEFAULT 'lara_bpl',
  postcard_sent_at TIMESTAMPTZ,
  postcard_batch_id UUID,
  converted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.postcard_prospects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on postcard_prospects"
  ON public.postcard_prospects FOR ALL
  TO service_role USING (true) WITH CHECK (true);

CREATE INDEX idx_postcard_prospects_county ON public.postcard_prospects (county);
CREATE INDEX idx_postcard_prospects_source ON public.postcard_prospects (source);

CREATE TRIGGER update_postcard_prospects_updated_at
  BEFORE UPDATE ON public.postcard_prospects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- postcard_campaigns: manages batches of postcards
CREATE TABLE public.postcard_campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  county TEXT NOT NULL,
  copy_front TEXT NOT NULL,
  copy_back TEXT NOT NULL,
  qr_url TEXT NOT NULL,
  prospect_count INTEGER DEFAULT 0,
  sent_count INTEGER DEFAULT 0,
  conversion_count INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  lob_batch_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.postcard_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on postcard_campaigns"
  ON public.postcard_campaigns FOR ALL
  TO service_role USING (true) WITH CHECK (true);

CREATE TRIGGER update_postcard_campaigns_updated_at
  BEFORE UPDATE ON public.postcard_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- postcard_conversions: tracks QR scan → checkout → paid
CREATE TABLE public.postcard_conversions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  prospect_id UUID REFERENCES public.postcard_prospects(id),
  campaign_id UUID REFERENCES public.postcard_campaigns(id),
  event TEXT NOT NULL DEFAULT 'scanned',
  stripe_session_id TEXT,
  county TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.postcard_conversions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on postcard_conversions"
  ON public.postcard_conversions FOR ALL
  TO service_role USING (true) WITH CHECK (true);

CREATE INDEX idx_postcard_conversions_campaign ON public.postcard_conversions (campaign_id);
