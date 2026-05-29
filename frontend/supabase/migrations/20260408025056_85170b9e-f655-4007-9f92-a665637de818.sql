CREATE TABLE public.prospect_pipeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name TEXT NOT NULL,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  website TEXT,
  city TEXT,
  state TEXT,
  industry TEXT,
  google_rating NUMERIC(2,1),
  review_count INTEGER,
  gbp_claimed BOOLEAN,
  google_place_id TEXT,
  pipeline_stage TEXT NOT NULL DEFAULT 'new_lead',
  pain_points JSONB,
  n8n_sent_at TIMESTAMPTZ,
  source TEXT DEFAULT 'dataforseo',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.prospect_pipeline ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public.prospect_pipeline FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE INDEX idx_pipeline_stage ON public.prospect_pipeline(pipeline_stage);
CREATE INDEX idx_pipeline_industry ON public.prospect_pipeline(industry);