
-- client_nps_scores
CREATE TABLE IF NOT EXISTS public.client_nps_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_email TEXT NOT NULL,
  product TEXT NOT NULL,
  score INTEGER,
  raw_reply TEXT,
  milestone_day INTEGER NOT NULL,
  surveyed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (client_email, product, milestone_day)
);

CREATE INDEX IF NOT EXISTS idx_nps_client_product ON public.client_nps_scores (client_email, product, surveyed_at DESC);

ALTER TABLE public.client_nps_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role bypass nps"
  ON public.client_nps_scores FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "admins read nps"
  ON public.client_nps_scores FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- missed_call_captures
CREATE TABLE IF NOT EXISTS public.missed_call_captures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  caller_number TEXT NOT NULL,
  city TEXT,
  voicemail_transcript TEXT,
  text_sent TEXT,
  reply_received TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  google_review_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_missed_call_captures_created ON public.missed_call_captures (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_missed_call_captures_status ON public.missed_call_captures (status);

ALTER TABLE public.missed_call_captures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role bypass mcc"
  ON public.missed_call_captures FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "admins read mcc"
  ON public.missed_call_captures FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins update mcc"
  ON public.missed_call_captures FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins delete mcc"
  ON public.missed_call_captures FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_mcc_updated_at ON public.missed_call_captures;
CREATE TRIGGER trg_mcc_updated_at
  BEFORE UPDATE ON public.missed_call_captures
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
