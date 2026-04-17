-- Unified prospect pool — one table for all audiences, both channels (postcard + fax)
CREATE TABLE IF NOT EXISTS public.prospect_pool (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_name TEXT NOT NULL,
  contact_name TEXT,
  audience_type TEXT NOT NULL, -- healthcare_staffing | nursing_home | trades_staffing | hvac | plumbing | electrical | supply_house | general_contractor | industrial_mfg | senior_care | school
  channel_hint TEXT NOT NULL DEFAULT 'postcard', -- postcard | fax | both
  -- Address (for postcards)
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT DEFAULT 'MI',
  zip TEXT,
  county TEXT,
  -- Contact
  phone TEXT,
  fax_number TEXT,
  email TEXT,
  website TEXT,
  -- Source/audit
  source TEXT NOT NULL, -- cms_medicare | npi_registry | lara_accela | sonar | sam_gov | manual | etc
  source_url TEXT,
  source_id TEXT, -- e.g. NPI number, license number, CMS ID
  verified_address BOOLEAN DEFAULT false,
  verified_fax BOOLEAN DEFAULT false,
  -- Scoring
  lead_score INTEGER DEFAULT 0,
  score_breakdown JSONB DEFAULT '{}'::jsonb,
  scored_at TIMESTAMPTZ,
  -- Intel signals (populated by score-prospects)
  cms_staffing_rating INTEGER,
  has_active_job_postings BOOLEAN DEFAULT false,
  has_demand_signal BOOLEAN DEFAULT false,
  recent_federal_contract BOOLEAN DEFAULT false,
  intel_notes JSONB DEFAULT '[]'::jsonb,
  -- Status
  status TEXT DEFAULT 'new', -- new | queued_postcard | queued_fax | sent | suppressed
  last_sent_at TIMESTAMPTZ,
  send_count INTEGER DEFAULT 0,
  -- Meta
  meta JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS prospect_pool_dedup
  ON public.prospect_pool (LOWER(business_name), COALESCE(zip, ''), audience_type);
CREATE INDEX IF NOT EXISTS prospect_pool_audience ON public.prospect_pool (audience_type);
CREATE INDEX IF NOT EXISTS prospect_pool_score ON public.prospect_pool (lead_score DESC);
CREATE INDEX IF NOT EXISTS prospect_pool_county ON public.prospect_pool (county);
CREATE INDEX IF NOT EXISTS prospect_pool_status ON public.prospect_pool (status);

ALTER TABLE public.prospect_pool ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage prospect_pool"
  ON public.prospect_pool FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role full access prospect_pool"
  ON public.prospect_pool FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE TRIGGER prospect_pool_updated_at
  BEFORE UPDATE ON public.prospect_pool
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Sample sends ledger — tracks 5-to-Matt's-house batches (prevents accidental re-sends)
CREATE TABLE IF NOT EXISTS public.sample_sends (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_id UUID NOT NULL DEFAULT gen_random_uuid(),
  channel TEXT NOT NULL, -- postcard | fax
  prospect_id UUID REFERENCES public.prospect_pool(id) ON DELETE SET NULL,
  audience_type TEXT NOT NULL,
  recipient_label TEXT, -- "Matt's house"
  provider_id TEXT, -- Lob/Phaxio id
  cost_cents INTEGER DEFAULT 0,
  status TEXT DEFAULT 'sent',
  preview_html TEXT,
  meta JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.sample_sends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view sample_sends"
  ON public.sample_sends FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role full access sample_sends"
  ON public.sample_sends FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');