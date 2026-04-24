DROP VIEW IF EXISTS public.enrichment_provider_health CASCADE;

CREATE TABLE public.enrichment_provider_health (
  provider TEXT PRIMARY KEY,
  credits_remaining INT,
  last_429_at TIMESTAMPTZ,
  daily_calls INT NOT NULL DEFAULT 0,
  daily_hits INT NOT NULL DEFAULT 0,
  daily_reset_at DATE NOT NULL DEFAULT CURRENT_DATE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.enrichment_provider_health ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_eph" ON public.enrichment_provider_health
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "admin_read_eph" ON public.enrichment_provider_health
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.enrichment_provider_health (provider) VALUES
  ('snov'), ('apollo'), ('hunter'), ('pdl'), ('pattern_verify'), ('site_scrape')
ON CONFLICT (provider) DO NOTHING;

CREATE OR REPLACE FUNCTION public.bump_provider_health(
  _provider TEXT,
  _hit BOOLEAN,
  _credits_remaining INT DEFAULT NULL,
  _was_429 BOOLEAN DEFAULT false
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.enrichment_provider_health AS eph (provider, credits_remaining, daily_calls, daily_hits, last_429_at, updated_at)
  VALUES (_provider, _credits_remaining, 1, CASE WHEN _hit THEN 1 ELSE 0 END,
          CASE WHEN _was_429 THEN now() ELSE NULL END, now())
  ON CONFLICT (provider) DO UPDATE SET
    daily_calls = CASE WHEN eph.daily_reset_at < CURRENT_DATE THEN 1 ELSE eph.daily_calls + 1 END,
    daily_hits = CASE WHEN eph.daily_reset_at < CURRENT_DATE THEN (CASE WHEN _hit THEN 1 ELSE 0 END)
                      ELSE eph.daily_hits + (CASE WHEN _hit THEN 1 ELSE 0 END) END,
    daily_reset_at = CASE WHEN eph.daily_reset_at < CURRENT_DATE THEN CURRENT_DATE ELSE eph.daily_reset_at END,
    credits_remaining = COALESCE(_credits_remaining, eph.credits_remaining),
    last_429_at = CASE WHEN _was_429 THEN now() ELSE eph.last_429_at END,
    updated_at = now();
END;
$$;