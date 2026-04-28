-- =========================================================================
-- Anti-Hallucination Guardrails for Mortgage Radar (and reusable elsewhere)
-- =========================================================================

-- ---------- 1. Quarantine table: rejected leads, full payload preserved ----
CREATE TABLE IF NOT EXISTS public.mortgage_radar_quarantine (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_lead_id UUID,                  -- if it had been inserted before
  full_name TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  signal_type TEXT,
  signal_source TEXT,
  signal_detail TEXT,
  signal_url TEXT,
  signal_date DATE,
  raw JSONB,
  reject_code TEXT NOT NULL,              -- e.g. address_unverifiable, placeholder_url, llm_low_confidence
  reject_reason TEXT NOT NULL,
  source_method TEXT,                     -- llm_search | scraper | api
  quarantined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID,
  review_action TEXT                      -- approved_promoted | deleted | blocklisted
);

ALTER TABLE public.mortgage_radar_quarantine ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_quarantine"
  ON public.mortgage_radar_quarantine
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "admins_read_quarantine"
  ON public.mortgage_radar_quarantine
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins_review_quarantine"
  ON public.mortgage_radar_quarantine
  FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_mr_quarantine_unreviewed
  ON public.mortgage_radar_quarantine (quarantined_at DESC)
  WHERE reviewed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_mr_quarantine_reject_code
  ON public.mortgage_radar_quarantine (reject_code, quarantined_at DESC);

-- ---------- 2. Address validation cache (24h TTL) -------------------------
CREATE TABLE IF NOT EXISTS public.address_validation_cache (
  cache_key TEXT PRIMARY KEY,             -- lower(trim(address))||'|'||zip
  pass BOOLEAN NOT NULL,
  formatted_address TEXT,
  lat DOUBLE PRECISION,
  lon DOUBLE PRECISION,
  granularity TEXT,                       -- PREMISE | SUB_PREMISE | ROUTE | ...
  missing_components TEXT[],
  unconfirmed_components TEXT[],
  raw_response JSONB,
  cached_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.address_validation_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_addr_cache"
  ON public.address_validation_cache
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_addr_cache_age
  ON public.address_validation_cache (cached_at);

-- ---------- 3. Cross-run quarantine memory --------------------------------
CREATE TABLE IF NOT EXISTS public.quarantine_history (
  address_zip_key TEXT PRIMARY KEY,       -- normalized address|zip
  first_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  hit_count INT NOT NULL DEFAULT 1,
  last_reject_code TEXT,
  permanent_blocklist BOOLEAN NOT NULL DEFAULT FALSE
);

ALTER TABLE public.quarantine_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_quarantine_history"
  ON public.quarantine_history
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "admins_read_quarantine_history"
  ON public.quarantine_history
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- ---------- 4. Atomic quarantine helper -----------------------------------
CREATE OR REPLACE FUNCTION public.quarantine_mortgage_lead(
  p_lead_id UUID,
  p_reject_code TEXT,
  p_reject_reason TEXT,
  p_source_method TEXT DEFAULT 'unknown'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_q_id UUID;
  v_key  TEXT;
BEGIN
  INSERT INTO public.mortgage_radar_quarantine (
    original_lead_id, full_name, address, city, state, zip,
    signal_type, signal_source, signal_detail, signal_url, signal_date,
    raw, reject_code, reject_reason, source_method
  )
  SELECT
    l.id, l.full_name, l.address, l.city, l.state, l.zip,
    l.signal_type, l.signal_source, l.signal_detail, l.signal_url, l.signal_date,
    l.raw, p_reject_code, p_reject_reason, p_source_method
  FROM public.mortgage_radar_leads l
  WHERE l.id = p_lead_id
  RETURNING id INTO v_q_id;

  IF v_q_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Update cross-run memory
  SELECT lower(trim(coalesce(address, '')))||'|'||coalesce(zip, '')
    INTO v_key
    FROM public.mortgage_radar_leads
   WHERE id = p_lead_id;

  INSERT INTO public.quarantine_history (address_zip_key, last_reject_code)
  VALUES (v_key, p_reject_code)
  ON CONFLICT (address_zip_key) DO UPDATE
    SET last_seen = now(),
        hit_count = public.quarantine_history.hit_count + 1,
        last_reject_code = EXCLUDED.last_reject_code;

  -- Remove from active leads
  DELETE FROM public.mortgage_radar_leads WHERE id = p_lead_id;

  RETURN v_q_id;
END;
$$;

REVOKE ALL ON FUNCTION public.quarantine_mortgage_lead(UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.quarantine_mortgage_lead(UUID, TEXT, TEXT, TEXT) TO service_role;

-- ---------- 5. One-shot sweep of existing suspicious rows -----------------
CREATE OR REPLACE FUNCTION public.sweep_suspicious_mortgage_leads()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  v_count INT := 0;
  v_reason TEXT;
  v_code TEXT;
BEGIN
  FOR r IN
    SELECT id, signal_url, signal_detail, signal_source, address, zip
      FROM public.mortgage_radar_leads
     WHERE
       -- Placeholder MLS / Realtor IDs (the real tell)
       (signal_url ~* 'M[X]{2,}|MXXXXX' OR signal_url ~ '_M\d{5,}_')
       OR signal_detail ~* 'MXXXXX|placeholder'
       -- Obvious LLM fingerprints in detail
       OR full_name = 'JOHN DOE'
       -- Source we know is hallucination-prone, no validated coords yet
       OR (signal_source IN ('FSBO', 'Sonar_PublicRecords', 'CircuitCourt',
                             'MLS_Fixer', 'EstateSales', 'JobChange', 'Probate')
           AND lat IS NULL)
  LOOP
    IF r.signal_url ~* 'M[X]{2,}' OR r.signal_detail ~* 'MXXXXX' THEN
      v_code := 'placeholder_url';
      v_reason := 'URL or detail contains placeholder MLS pattern (MXXXXX / M\d{5,})';
    ELSIF r.full_name = 'JOHN DOE' THEN
      v_code := 'llm_placeholder_name';
      v_reason := 'Owner name returned as JOHN DOE — clear LLM placeholder';
    ELSE
      v_code := 'unvalidated_llm_source';
      v_reason := 'LLM-sourced lead from before address-validation gate (' || r.signal_source || ')';
    END IF;

    PERFORM public.quarantine_mortgage_lead(r.id, v_code, v_reason, 'llm_search');
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.sweep_suspicious_mortgage_leads() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sweep_suspicious_mortgage_leads() TO service_role;

-- ---------- 6. Cache cleanup (24h TTL) ------------------------------------
CREATE OR REPLACE FUNCTION public.purge_address_validation_cache()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted INT;
BEGIN
  DELETE FROM public.address_validation_cache
   WHERE cached_at < now() - INTERVAL '24 hours';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.purge_address_validation_cache() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.purge_address_validation_cache() TO service_role;

-- ---------- 7. Helpful index on leads table for the validation backfill ---
CREATE INDEX IF NOT EXISTS idx_mr_leads_unvalidated
  ON public.mortgage_radar_leads (created_at DESC)
  WHERE lat IS NULL;
