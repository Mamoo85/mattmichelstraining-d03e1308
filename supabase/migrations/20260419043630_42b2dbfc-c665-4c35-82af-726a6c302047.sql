
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS earthdistance CASCADE;

ALTER TABLE public.hire_alert_candidates ADD COLUMN IF NOT EXISTS search_vector tsvector;
CREATE OR REPLACE FUNCTION public.hire_REDACTED()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.name,'') || ' ' || coalesce(NEW.full_name,'')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.current_employer,'') || ' ' || coalesce(NEW.current_title,'')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.trade,'') || ' ' || coalesce(NEW.license_type,'')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.city,'') || ' ' || coalesce(NEW.state,'') || ' ' || coalesce(NEW.zip,'')), 'C') ||
    setweight(to_tsvector('english', coalesce(NEW.qualifications_summary,'')), 'D');
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_hire_REDACTED ON public.hire_alert_candidates;
CREATE TRIGGER trg_hire_REDACTED BEFORE INSERT OR UPDATE ON public.hire_alert_candidates
  FOR EACH ROW EXECUTE FUNCTION public.hire_REDACTED();
CREATE INDEX IF NOT EXISTS idx_hire_REDACTED ON public.hire_alert_candidates USING gin(search_vector);
UPDATE public.hire_alert_candidates SET name = name WHERE search_vector IS NULL;

ALTER TABLE public.industry_pulse_signals ADD COLUMN IF NOT EXISTS search_vector tsvector;
CREATE OR REPLACE FUNCTION public.industry_pulse_signals_search_trigger()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.company_name,'')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.recommended_pitch,'')), 'B') ||
    setweight(to_tsvector('english', coalesce(array_to_string(NEW.predicted_needs, ' '), '') || ' ' || coalesce(array_to_string(NEW.hiring_roles, ' '), '')), 'C') ||
    setweight(to_tsvector('english', coalesce(NEW.signal_type,'') || ' ' || coalesce(NEW.industry,'') || ' ' || coalesce(NEW.location,'')), 'D');
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_industry_pulse_search ON public.industry_pulse_signals;
CREATE TRIGGER trg_industry_pulse_search BEFORE INSERT OR UPDATE ON public.industry_pulse_signals
  FOR EACH ROW EXECUTE FUNCTION public.industry_pulse_signals_search_trigger();
CREATE INDEX IF NOT EXISTS idx_industry_pulse_search ON public.industry_pulse_signals USING gin(search_vector);
UPDATE public.industry_pulse_signals SET company_name = company_name WHERE search_vector IS NULL;

ALTER TABLE public.hire_alert_candidates ADD COLUMN IF NOT EXISTS embedding vector(768);
ALTER TABLE public.industry_pulse_signals ADD COLUMN IF NOT EXISTS embedding vector(768);
CREATE INDEX IF NOT EXISTS idx_hire_REDACTED ON public.hire_alert_candidates USING ivfflat (embedding vector_cosine_ops) WITH (lists=100);
CREATE INDEX IF NOT EXISTS idx_industry_pulse_embedding ON public.industry_pulse_signals USING ivfflat (embedding vector_cosine_ops) WITH (lists=100);

CREATE OR REPLACE FUNCTION public.match_signals_semantic(
  query_embedding vector(768), match_threshold float DEFAULT 0.75,
  match_count int DEFAULT 20, industry_filter text DEFAULT NULL
) RETURNS TABLE (id uuid, company_name text, recommended_pitch text, similarity float, confidence int)
LANGUAGE sql STABLE AS $$
  SELECT s.id, s.company_name, s.recommended_pitch,
         1 - (s.embedding <=> query_embedding) AS similarity, s.confidence
  FROM public.industry_pulse_signals s
  WHERE s.embedding IS NOT NULL
    AND (industry_filter IS NULL OR s.industry = industry_filter)
    AND 1 - (s.embedding <=> query_embedding) > match_threshold
  ORDER BY s.embedding <=> query_embedding LIMIT match_count;
$$;
GRANT EXECUTE ON FUNCTION public.match_signals_semantic(vector, float, int, text) TO service_role, authenticated;

CREATE OR REPLACE FUNCTION public.search_candidates_hybrid(
  query_text text, query_embedding vector(768) DEFAULT NULL,
  city_filter text DEFAULT NULL, state_filter text DEFAULT NULL,
  min_score int DEFAULT 0, limit_n int DEFAULT 25
) RETURNS TABLE (
  id uuid, name text, trade text, city text, state text, score int,
  current_employer text, license_type text, created_at timestamptz,
  fts_rank float, semantic_sim float, freshness float, blended_rank float
) LANGUAGE sql STABLE AS $$
  WITH base AS (
    SELECT c.id, c.name, c.trade, c.city, c.state, c.score, c.current_employer,
           c.license_type, c.created_at,
           ts_rank(c.search_vector, websearch_to_tsquery('english', coalesce(query_text,''))) AS fts_rank,
           CASE WHEN query_embedding IS NOT NULL AND c.embedding IS NOT NULL
                THEN 1 - (c.embedding <=> query_embedding) ELSE 0 END AS semantic_sim,
           exp(-extract(epoch FROM (now() - c.created_at)) / (14.0 * 86400)) AS freshness
    FROM public.hire_alert_candidates c
    WHERE (query_text IS NULL OR query_text = '' OR c.search_vector @@ websearch_to_tsquery('english', query_text))
      AND (city_filter IS NULL OR c.city ILIKE city_filter)
      AND (state_filter IS NULL OR c.state = state_filter)
      AND COALESCE(c.score, 0) >= min_score
  )
  SELECT id, name, trade, city, state, score, current_employer, license_type, created_at,
         fts_rank, semantic_sim, freshness,
         (0.4 * fts_rank + 0.4 * semantic_sim + 0.2 * freshness) AS blended_rank
  FROM base ORDER BY blended_rank DESC LIMIT limit_n;
$$;
GRANT EXECUTE ON FUNCTION public.search_candidates_hybrid(text, vector, text, text, int, int) TO service_role, authenticated;

CREATE TABLE IF NOT EXISTS public.signal_correlations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_a_type text NOT NULL, signal_a_id uuid NOT NULL,
  signal_b_type text NOT NULL, signal_b_id uuid NOT NULL,
  correlation_score float NOT NULL, correlation_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (signal_a_type, signal_a_id, signal_b_type, signal_b_id)
);
ALTER TABLE public.signal_correlations ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='signal_correlations' AND policyname='service_role_all_corr') THEN
    CREATE POLICY "service_role_all_corr" ON public.signal_correlations FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_corr_lookup ON public.signal_correlations (signal_a_type, signal_a_id);

CREATE OR REPLACE FUNCTION public.correlate_pulse_to_candidates(p_pulse_id uuid)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_pulse record; v_count int := 0;
BEGIN
  SELECT id, company_name, signal_type, confidence INTO v_pulse FROM public.industry_pulse_signals WHERE id = p_pulse_id;
  IF NOT FOUND OR v_pulse.company_name IS NULL THEN RETURN 0; END IF;
  INSERT INTO public.signal_correlations (signal_a_type, signal_a_id, signal_b_type, signal_b_id, correlation_score, correlation_reason)
  SELECT 'pulse', v_pulse.id, 'candidate', c.id,
         similarity(c.current_employer, v_pulse.company_name) * (v_pulse.confidence / 10.0),
         format('employer match (%.2f) on %s', similarity(c.current_employer, v_pulse.company_name), v_pulse.signal_type)
  FROM public.hire_alert_candidates c
  WHERE c.current_employer IS NOT NULL AND similarity(c.current_employer, v_pulse.company_name) > 0.5
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END $$;
GRANT EXECUTE ON FUNCTION public.correlate_pulse_to_candidates(uuid) TO service_role;

CREATE INDEX IF NOT EXISTS idx_candidates_name_trgm ON public.hire_alert_candidates USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_candidates_employer_trgm ON public.hire_alert_candidates USING gin (current_employer gin_trgm_ops);

CREATE OR REPLACE FUNCTION public.dedup_candidates_fuzzy(
  p_name text, p_city text DEFAULT NULL, p_threshold float DEFAULT 0.85
) RETURNS TABLE (id uuid, name text, city text, similarity float)
LANGUAGE sql STABLE AS $$
  SELECT c.id, c.name, c.city, similarity(c.name, p_name) AS sim
  FROM public.hire_alert_candidates c
  WHERE similarity(c.name, p_name) >= p_threshold
    AND (p_city IS NULL OR c.city IS NULL OR similarity(coalesce(c.city,''), p_city) >= 0.6)
  ORDER BY sim DESC LIMIT 5;
$$;
GRANT EXECUTE ON FUNCTION public.dedup_candidates_fuzzy(text, text, float) TO service_role;

CREATE OR REPLACE FUNCTION public.compute_freshness_score(
  p_created_at timestamptz, p_half_life_days float DEFAULT 14
) RETURNS float LANGUAGE sql IMMUTABLE AS $$
  SELECT exp(-ln(2) * extract(epoch FROM (now() - p_created_at)) / (p_half_life_days * 86400));
$$;
GRANT EXECUTE ON FUNCTION public.compute_freshness_score(timestamptz, float) TO service_role, authenticated;

CREATE TABLE IF NOT EXISTS public.search_query_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid, client_id uuid, product text NOT NULL,
  query_text text, filters jsonb, result_count int,
  clicked_result_id uuid, latency_ms int,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.search_query_log ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='search_query_log' AND policyname='service_role_all_search_log') THEN
    CREATE POLICY "service_role_all_search_log" ON public.search_query_log FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_search_log_product_recent ON public.search_query_log (product, created_at DESC);

-- Renamed to avoid collision with pre-existing saved_searches table
CREATE TABLE IF NOT EXISTS public.saved_search_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL, product text NOT NULL,
  label text NOT NULL, query_text text,
  filters jsonb NOT NULL DEFAULT '{}',
  alert_enabled boolean NOT NULL DEFAULT true,
  alert_channel text NOT NULL DEFAULT 'email',
  last_match_id uuid, last_alerted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.saved_search_alerts ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='saved_search_alerts' AND policyname='service_role_all_saved_alerts') THEN
    CREATE POLICY "service_role_all_saved_alerts" ON public.saved_search_alerts FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_saved_search_alerts_client ON public.saved_search_alerts (client_id, alert_enabled);

ALTER TABLE public.hire_alert_candidates
  ADD COLUMN IF NOT EXISTS lat double precision,
  ADD COLUMN IF NOT EXISTS lng double precision;

CREATE INDEX IF NOT EXISTS idx_candidates_geo
  ON public.hire_alert_candidates USING gist (ll_to_earth(lat, lng))
  WHERE lat IS NOT NULL AND lng IS NOT NULL;

CREATE OR REPLACE FUNCTION public.candidates_within_radius(
  p_lat double precision, p_lng double precision, p_radius_miles float DEFAULT 25,
  p_min_score int DEFAULT 0, p_limit int DEFAULT 50
) RETURNS TABLE (id uuid, name text, trade text, city text, score int, distance_miles float)
LANGUAGE sql STABLE AS $$
  SELECT c.id, c.name, c.trade, c.city, c.score,
         earth_distance(ll_to_earth(p_lat, p_lng), ll_to_earth(c.lat, c.lng)) / 1609.34 AS distance_miles
  FROM public.hire_alert_candidates c
  WHERE c.lat IS NOT NULL AND c.lng IS NOT NULL
    AND COALESCE(c.score, 0) >= p_min_score
    AND earth_box(ll_to_earth(p_lat, p_lng), p_radius_miles * 1609.34) @> ll_to_earth(c.lat, c.lng)
    AND earth_distance(ll_to_earth(p_lat, p_lng), ll_to_earth(c.lat, c.lng)) <= p_radius_miles * 1609.34
  ORDER BY distance_miles LIMIT p_limit;
$$;
GRANT EXECUTE ON FUNCTION public.candidates_within_radius(double precision, double precision, float, int, int) TO service_role, authenticated;

CREATE OR REPLACE VIEW public.unified_signals AS
SELECT 'candidate' AS signal_type, c.id,
  c.name AS title, c.current_employer AS subtitle, c.city, c.state,
  c.created_at, COALESCE(c.score, 0) AS confidence,
  exp(-ln(2) * extract(epoch FROM (now() - c.created_at)) / (14.0 * 86400)) AS freshness,
  COALESCE(c.score, 0) * exp(-ln(2) * extract(epoch FROM (now() - c.created_at)) / (14.0 * 86400)) AS rank_score
FROM public.hire_alert_candidates c
WHERE c.created_at > now() - interval '60 days'
UNION ALL
SELECT 'pulse' AS signal_type, s.id,
  s.company_name AS title, s.recommended_pitch AS subtitle, NULL::text AS city, NULL::text AS state,
  s.created_at, COALESCE(s.confidence, 0) AS confidence,
  exp(-ln(2) * extract(epoch FROM (now() - s.created_at)) / (7.0 * 86400)) AS freshness,
  COALESCE(s.confidence, 0) * exp(-ln(2) * extract(epoch FROM (now() - s.created_at)) / (7.0 * 86400)) AS rank_score
FROM public.industry_pulse_signals s
WHERE s.created_at > now() - interval '30 days';

GRANT SELECT ON public.unified_signals TO service_role, authenticated;
