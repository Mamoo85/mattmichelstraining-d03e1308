
CREATE TABLE public.daily_text_targets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_name TEXT NOT NULL,
  phone TEXT,
  trade TEXT,
  city TEXT,
  google_reviews INT,
  website_url TEXT,
  suggested_text TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.daily_text_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on daily_text_targets"
  ON public.daily_text_targets
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE INDEX idx_daily_text_targets_status ON public.daily_text_targets (status);
CREATE INDEX idx_daily_text_targets_created ON public.daily_text_targets (created_at DESC);
