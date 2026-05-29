
-- =============================================
-- Prospect Pipeline Tables
-- =============================================

-- 1. prospect_businesses: The lead database for Neo outreach
CREATE TABLE IF NOT EXISTS public.prospect_businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name TEXT NOT NULL,
  email TEXT,
  address TEXT,
  city TEXT,
  state TEXT DEFAULT 'MI',
  phone TEXT,
  website TEXT,
  industry TEXT,
  google_place_id TEXT UNIQUE,
  review_count INTEGER DEFAULT 0,
  rating NUMERIC(2,1),
  tier TEXT DEFAULT 'C',
  has_website BOOLEAN DEFAULT true,
  outreach_status TEXT DEFAULT 'new',
  notes TEXT,
  source TEXT DEFAULT 'google_maps',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE public.prospect_businesses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_prospect_businesses"
  ON public.prospect_businesses
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Indexes for Neo's query patterns
CREATE INDEX IF NOT EXISTS idx_prospect_businesses_tier ON public.prospect_businesses (tier);
CREATE INDEX IF NOT EXISTS idx_prospect_businesses_outreach_status ON public.prospect_businesses (outreach_status);
CREATE INDEX IF NOT EXISTS idx_prospect_businesses_industry ON public.prospect_businesses (industry);
CREATE INDEX IF NOT EXISTS idx_prospect_businesses_created_at ON public.prospect_businesses (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_prospect_businesses_new_a_tier ON public.prospect_businesses (tier, outreach_status) WHERE outreach_status = 'new';

-- 2. prospect_outreach: Tracks every email Neo sends
CREATE TABLE IF NOT EXISTS public.prospect_outreach (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id UUID REFERENCES public.prospect_businesses(id) ON DELETE CASCADE,
  email TEXT,
  business_name TEXT,
  industry TEXT,
  outreach_type TEXT DEFAULT 'initial',
  subject TEXT,
  status TEXT DEFAULT 'sent',
  sent_at TIMESTAMPTZ DEFAULT now(),
  replied_at TIMESTAMPTZ
);

-- RLS
ALTER TABLE public.prospect_outreach ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_prospect_outreach"
  ON public.prospect_outreach
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Index for daily cap counting
CREATE INDEX IF NOT EXISTS idx_prospect_outreach_sent_at ON public.prospect_outreach (sent_at DESC);
