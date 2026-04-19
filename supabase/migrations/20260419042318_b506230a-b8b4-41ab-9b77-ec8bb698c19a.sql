-- 1. Per-candidate stage state
CREATE TABLE IF NOT EXISTS public.enrichment_stage_state (
  candidate_id uuid PRIMARY KEY REFERENCES public.hire_alert_candidates(id) ON DELETE CASCADE,
  current_stage text NOT NULL DEFAULT '2_npi',
  completed_stages text[] NOT NULL DEFAULT '{}',
  failed_stages text[] NOT NULL DEFAULT '{}',
  merged_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  total_cost_usd numeric(10,4) NOT NULL DEFAULT 0,
  started_at timestamptz NOT NULL DEFAULT now(),
  last_advanced_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
ALTER TABLE public.enrichment_stage_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_stage_state" ON public.enrichment_stage_state
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_stage_state_unfinished
  ON public.enrichment_stage_state(last_advanced_at) WHERE finished_at IS NULL;

-- 2. Per-source daily budgets
CREATE TABLE IF NOT EXISTS public.enrichment_source_budgets (
  source text PRIMARY KEY,
  daily_cap_usd numeric(10,4) NOT NULL,
  daily_call_cap int NOT NULL DEFAULT 1000,
  spent_today_usd numeric(10,4) NOT NULL DEFAULT 0,
  calls_today int NOT NULL DEFAULT 0,
  reset_at date NOT NULL DEFAULT current_date,
  enabled boolean NOT NULL DEFAULT true,
  notes text
);
ALTER TABLE public.enrichment_source_budgets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_budgets" ON public.enrichment_source_budgets
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Seed budgets — values reflect talent-radar v5 audit
INSERT INTO public.enrichment_source_budgets (source, daily_cap_usd, daily_call_cap, enabled, notes) VALUES
  ('npi',         0,    1000, true,  'Free CMS API'),
  ('pdl',         0.50, 50,   true,  'V5 audit: 0 hits in 100+ tries; tiny cap'),
  ('hunter',      0.50, 25,   true,  'V5 audit: skipped without employer'),
  ('snov',        0.50, 25,   true,  'V5 audit: skipped without employer'),
  ('lusha',       0.50, 10,   true,  'V5 audit: skipped without employer'),
  ('sonar',       5.00, 500,  true,  'V5 audit: carrying enrichment at $0.005/cand'),
  ('ninjapear',   1.00, 50,   true,  'Only fires when LinkedIn URL present'),
  ('crustdata',   2.00, 50,   true,  'Trial fallback'),
  ('clay',        2.00, 20,   true,  'Score >= 7 only')
ON CONFLICT (source) DO NOTHING;

-- 3. Atomic budget consumption
CREATE OR REPLACE FUNCTION public.consume_source_budget(_source text, _cost numeric)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.enrichment_source_budgets%ROWTYPE;
BEGIN
  -- Roll the day if needed
  UPDATE public.enrichment_source_budgets
     SET spent_today_usd = 0, calls_today = 0, reset_at = current_date
   WHERE source = _source AND reset_at < current_date;

  SELECT * INTO _row FROM public.enrichment_source_budgets
   WHERE source = _source FOR UPDATE;
  IF NOT FOUND OR NOT _row.enabled THEN RETURN false; END IF;

  IF _row.spent_today_usd + _cost > _row.daily_cap_usd
     OR _row.calls_today + 1 > _row.daily_call_cap THEN
    RETURN false;
  END IF;

  UPDATE public.enrichment_source_budgets
     SET spent_today_usd = spent_today_usd + _cost,
         calls_today = calls_today + 1
   WHERE source = _source;
  RETURN true;
END;
$$;
GRANT EXECUTE ON FUNCTION public.consume_source_budget(text, numeric) TO service_role;

-- 4. next_enrich_stage — returns the next stage given history + payload
-- Order: 2_npi -> 3_pdl -> 4_hunter -> 5_snov -> 6_lusha -> 7_sonar
--         -> 7b_ninjapear -> 7c_crustdata -> 8_clay -> done
CREATE OR REPLACE FUNCTION public.next_enrich_stage(_candidate_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _state public.enrichment_stage_state%ROWTYPE;
  _cand  public.hire_alert_candidates%ROWTYPE;
  _has_employer boolean;
  _has_linkedin boolean;
  _has_contact boolean;
  _score int;
  _stages text[] := ARRAY['2_npi','3_pdl','4_hunter','5_snov','6_lusha','7_sonar','7b_ninjapear','7c_crustdata','8_clay'];
  _s text;
BEGIN
  SELECT * INTO _state FROM public.enrichment_stage_state WHERE candidate_id = _candidate_id;
  SELECT * INTO _cand  FROM public.hire_alert_candidates WHERE id = _candidate_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  _has_employer := COALESCE(_cand.current_employer, (_state.merged_payload->>'current_employer')) IS NOT NULL;
  _has_linkedin := COALESCE(_cand.linkedin_url,    (_state.merged_payload->>'linkedin_url'))    IS NOT NULL;
  _has_contact  := COALESCE(_cand.email, _cand.phone,
                            (_state.merged_payload->>'email'),
                            (_state.merged_payload->>'phone')) IS NOT NULL;
  _score := COALESCE(_cand.score, 0);

  FOREACH _s IN ARRAY _stages LOOP
    IF _state.completed_stages @> ARRAY[_s] OR _state.failed_stages @> ARRAY[_s] THEN
      CONTINUE;
    END IF;

    -- Short-circuits per v5 audit
    IF _s IN ('4_hunter','5_snov','6_lusha') AND NOT _has_employer THEN CONTINUE; END IF;
    IF _s = '7b_ninjapear' AND NOT _has_linkedin THEN CONTINUE; END IF;
    IF _s = '8_clay' AND (_score < 7 OR _has_contact) THEN CONTINUE; END IF;

    RETURN _s;
  END LOOP;

  RETURN NULL; -- waterfall exhausted
END;
$$;
GRANT EXECUTE ON FUNCTION public.next_enrich_stage(uuid) TO service_role;

-- 5. enqueue_stage — posts a single-stage message to pgmq.enrich_jobs
CREATE OR REPLACE FUNCTION public.enqueue_stage(_candidate_id uuid, _stage text)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _msg_id bigint;
BEGIN
  SELECT pgmq.send('enrich_jobs',
    jsonb_build_object('candidate_id', _candidate_id, 'stage', _stage, 'enqueued_at', now())
  ) INTO _msg_id;
  RETURN _msg_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.enqueue_stage(uuid, text) TO service_role;

-- 6. New trigger — enqueue first stage on candidate insert
CREATE OR REPLACE FUNCTION public.trigger_enqueue_enrich_v2()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.enrichment_status IS NULL OR NEW.enrichment_status = 'pending' THEN
    INSERT INTO public.enrichment_stage_state (candidate_id, current_stage)
      VALUES (NEW.id, '2_npi')
    ON CONFLICT (candidate_id) DO NOTHING;
    PERFORM public.enqueue_stage(NEW.id, '2_npi');
  END IF;
  RETURN NEW;
END;
$$;

-- 7. Observability views
CREATE OR REPLACE VIEW public.enrich_observability AS
SELECT
  source,
  count(*)                                            AS calls_24h,
  sum(CASE WHEN success THEN 1 ELSE 0 END)            AS hits_24h,
  round(100.0 * sum(CASE WHEN success THEN 1 ELSE 0 END) / NULLIF(count(*),0), 1) AS hit_rate_pct,
  round(sum(coalesce(cost_estimate,0))::numeric, 4)   AS spend_24h_usd,
  count(DISTINCT candidate_id)                        AS unique_candidates
FROM public.candidate_enrichment_log
WHERE created_at > now() - interval '24 hours'
GROUP BY source
ORDER BY hits_24h DESC;
GRANT SELECT ON public.enrich_observability TO service_role, authenticated;

CREATE OR REPLACE VIEW public.dlq_enrich_inspector AS
SELECT
  msg_id, enqueued_at, read_ct,
  message->>'candidate_id' AS candidate_id,
  message->>'stage'        AS stage,
  message->>'error'        AS last_error
FROM pgmq.q_dlq_enrich
ORDER BY enqueued_at DESC;
GRANT SELECT ON public.dlq_enrich_inspector TO service_role;

-- 8. queue_depth_snapshot — for admin dashboards
CREATE OR REPLACE FUNCTION public.queue_depth_snapshot()
RETURNS TABLE(queue_name text, depth bigint, oldest_age interval)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pgmq
AS $$
BEGIN
  RETURN QUERY
    SELECT 'scrape_jobs'::text,
           (SELECT count(*) FROM pgmq.q_scrape_jobs),
           (SELECT now() - min(enqueued_at) FROM pgmq.q_scrape_jobs)
    UNION ALL
    SELECT 'enrich_jobs',
           (SELECT count(*) FROM pgmq.q_enrich_jobs),
           (SELECT now() - min(enqueued_at) FROM pgmq.q_enrich_jobs)
    UNION ALL
    SELECT 'dlq_scrape',
           (SELECT count(*) FROM pgmq.q_dlq_scrape),
           (SELECT now() - min(enqueued_at) FROM pgmq.q_dlq_scrape)
    UNION ALL
    SELECT 'dlq_enrich',
           (SELECT count(*) FROM pgmq.q_dlq_enrich),
           (SELECT now() - min(enqueued_at) FROM pgmq.q_dlq_enrich);
END;
$$;
GRANT EXECUTE ON FUNCTION public.queue_depth_snapshot() TO service_role, authenticated;