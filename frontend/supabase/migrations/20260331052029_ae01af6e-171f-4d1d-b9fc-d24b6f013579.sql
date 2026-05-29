
-- Track inbound lead conversions from drip campaigns
CREATE TABLE IF NOT EXISTS public.drip_conversions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  business_name TEXT,
  industry TEXT,
  service_interested TEXT,
  source TEXT DEFAULT 'direct',
  drip_step_converted TEXT,
  converted_at TIMESTAMPTZ DEFAULT now(),
  stripe_checkout_completed BOOLEAN DEFAULT false,
  revenue_amount NUMERIC DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb
);

ALTER TABLE public.drip_conversions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on drip_conversions"
  ON public.drip_conversions FOR ALL
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Admin read drip_conversions"
  ON public.drip_conversions FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Add industry column to marketing_leads if not exists
ALTER TABLE public.marketing_leads ADD COLUMN IF NOT EXISTS industry TEXT;
ALTER TABLE public.marketing_leads ADD COLUMN IF NOT EXISTS service_interested TEXT;
ALTER TABLE public.marketing_leads ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.marketing_leads ADD COLUMN IF NOT EXISTS business_name TEXT;
ALTER TABLE public.marketing_leads ADD COLUMN IF NOT EXISTS utm_source TEXT DEFAULT 'direct';
