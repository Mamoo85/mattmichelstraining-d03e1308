-- ============================================================================
-- 1. NEW TABLES
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.admin_decision_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid,
  action_type text NOT NULL,
  target_table text NOT NULL,
  target_id text,
  before_value jsonb,
  after_value jsonb,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_admin_decision_audit_created ON public.admin_decision_audit (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_decision_audit_target ON public.admin_decision_audit (target_table, target_id);
ALTER TABLE public.admin_decision_audit ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.cron_health_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  surface_name text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('info','warn','critical')),
  message text,
  acknowledged_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cron_health_events_created ON public.cron_health_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cron_health_events_unack ON public.cron_health_events (severity, created_at DESC) WHERE acknowledged_at IS NULL;
ALTER TABLE public.cron_health_events ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.edge_health_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  function_name text NOT NULL,
  status_code int,
  latency_ms int,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_edge_health_events_fn_created ON public.edge_health_events (function_name, created_at DESC);
ALTER TABLE public.edge_health_events ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.orphan_scan_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_at timestamptz NOT NULL DEFAULT now(),
  category text NOT NULL CHECK (category IN ('page','component','migration')),
  path text NOT NULL,
  reason text
);
CREATE INDEX IF NOT EXISTS idx_orphan_scan_results_run ON public.orphan_scan_results (run_at DESC);
ALTER TABLE public.orphan_scan_results ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.lead_event_corroborations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL,
  source text NOT NULL,
  source_url text,
  event_type text,
  matched boolean NOT NULL DEFAULT false,
  detail jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lec_lead_id ON public.lead_event_corroborations (lead_id);
ALTER TABLE public.lead_event_corroborations ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 2. COLUMNS on mortgage_radar_leads
-- ============================================================================
ALTER TABLE public.mortgage_radar_leads
  ADD COLUMN IF NOT EXISTS intent_score numeric(5,2),
  ADD COLUMN IF NOT EXISTS intent_score_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS extractor_run_id uuid,
  ADD COLUMN IF NOT EXISTS verifier_grounded boolean,
  ADD COLUMN IF NOT EXISTS verifier_citation_match boolean,
  ADD COLUMN IF NOT EXISTS verification_method text;
CREATE INDEX IF NOT EXISTS idx_mr_leads_intent_score ON public.mortgage_radar_leads (intent_score DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_mr_leads_pipeline_stage ON public.mortgage_radar_leads (pipeline_stage);

-- ============================================================================
-- 3. RLS — service_role bypass + admin/coach SELECT on new tables
-- ============================================================================
DO $$ BEGIN EXECUTE 'CREATE POLICY "service_role bypass admin_decision_audit" ON public.admin_decision_audit AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true)'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'CREATE POLICY "admin/coach read admin_decision_audit" ON public.admin_decision_audit FOR SELECT TO authenticated USING (public.has_role(auth.uid(),''admin''::app_role) OR public.has_role(auth.uid(),''coach''::app_role))'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'CREATE POLICY "service_role bypass cron_health_events" ON public.cron_health_events AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true)'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'CREATE POLICY "admin/coach read cron_health_events" ON public.cron_health_events FOR SELECT TO authenticated USING (public.has_role(auth.uid(),''admin''::app_role) OR public.has_role(auth.uid(),''coach''::app_role))'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'CREATE POLICY "service_role bypass edge_health_events" ON public.edge_health_events AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true)'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'CREATE POLICY "admin/coach read edge_health_events" ON public.edge_health_events FOR SELECT TO authenticated USING (public.has_role(auth.uid(),''admin''::app_role) OR public.has_role(auth.uid(),''coach''::app_role))'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'CREATE POLICY "service_role bypass orphan_scan_results" ON public.orphan_scan_results AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true)'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'CREATE POLICY "admin/coach read orphan_scan_results" ON public.orphan_scan_results FOR SELECT TO authenticated USING (public.has_role(auth.uid(),''admin''::app_role) OR public.has_role(auth.uid(),''coach''::app_role))'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'CREATE POLICY "service_role bypass lead_event_corroborations" ON public.lead_event_corroborations AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true)'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'CREATE POLICY "admin/coach read lead_event_corroborations" ON public.lead_event_corroborations FOR SELECT TO authenticated USING (public.has_role(auth.uid(),''admin''::app_role) OR public.has_role(auth.uid(),''coach''::app_role))'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Coach SELECT on existing real tables (skip enrichment_provider_spend_daily — it's a view; coach inherits via underlying table grants)
DO $$ BEGIN EXECUTE 'CREATE POLICY "coach read mortgage_radar_leads" ON public.mortgage_radar_leads FOR SELECT TO authenticated USING (public.has_role(auth.uid(),''coach''::app_role))'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'CREATE POLICY "coach read enrichment_decision_audit" ON public.enrichment_decision_audit FOR SELECT TO authenticated USING (public.has_role(auth.uid(),''coach''::app_role))'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'CREATE POLICY "coach read enrichment_dead_letter" ON public.enrichment_dead_letter FOR SELECT TO authenticated USING (public.has_role(auth.uid(),''coach''::app_role))'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'CREATE POLICY "coach read enrichment_walker_config" ON public.enrichment_walker_config FOR SELECT TO authenticated USING (public.has_role(auth.uid(),''coach''::app_role))'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'CREATE POLICY "coach read health_check_pings" ON public.health_check_pings FOR SELECT TO authenticated USING (public.has_role(auth.uid(),''coach''::app_role))'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================================
-- 4. SQL FUNCTIONS
-- ============================================================================
CREATE OR REPLACE FUNCTION public.quarantine_suspect_leads()
RETURNS TABLE(quarantined_count int, sample_reasons jsonb)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count int := 0; v_reasons jsonb;
BEGIN
  WITH updated AS (
    UPDATE public.mortgage_radar_leads
    SET pipeline_stage = 'quarantined_pre_validation',
        quarantine_reason = CASE
          WHEN lat IS NULL OR lon IS NULL THEN 'missing_coordinates'
          WHEN signal_url IS NULL OR signal_url = '' OR signal_url ILIKE '%example.com%' OR signal_url ILIKE '%placeholder%' THEN 'placeholder_url'
          WHEN address IS NULL OR length(trim(address)) < 5 THEN 'invalid_address'
          WHEN address ILIKE '%123 main st%' OR address ILIKE '%fake st%' OR address ILIKE '%test ave%' THEN 'fabricated_address_pattern'
          WHEN provenance_source_urls IS NULL OR jsonb_array_length(COALESCE(provenance_source_urls,'[]'::jsonb)) = 0 THEN 'no_provenance'
          ELSE 'unknown_suspicion' END
    WHERE pipeline_stage IS DISTINCT FROM 'quarantined_pre_validation'
      AND pipeline_stage IS DISTINCT FROM 'archived_low_intent'
      AND (lat IS NULL OR lon IS NULL
           OR signal_url IS NULL OR signal_url = ''
           OR signal_url ILIKE '%example.com%' OR signal_url ILIKE '%placeholder%'
           OR address IS NULL OR length(trim(address)) < 5
           OR address ILIKE '%123 main st%' OR address ILIKE '%fake st%' OR address ILIKE '%test ave%'
           OR provenance_source_urls IS NULL
           OR jsonb_array_length(COALESCE(provenance_source_urls,'[]'::jsonb)) = 0)
    RETURNING quarantine_reason)
  SELECT count(*)::int, jsonb_object_agg(quarantine_reason, cnt) INTO v_count, v_reasons
  FROM (SELECT quarantine_reason, count(*) cnt FROM updated GROUP BY quarantine_reason) s;
  RETURN QUERY SELECT v_count, COALESCE(v_reasons,'{}'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.compute_lead_intent_score(_lead_id uuid)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_lead public.mortgage_radar_leads; v_weights jsonb; v_event_weight numeric := 1.0;
        v_signal_strength numeric := 1.0; v_decay numeric := 0.0; v_days numeric := 0; v_score numeric;
BEGIN
  SELECT * INTO v_lead FROM public.mortgage_radar_leads WHERE id = _lead_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT (value_text::jsonb) INTO v_weights FROM public.enrichment_walker_config WHERE key='intent_weights' LIMIT 1;
  IF v_weights IS NULL THEN
    v_weights := '{"divorce":4.0,"probate":4.5,"fsbo":3.0,"foreclosure":5.0,"default":2.0,"decay_per_day":0.05}'::jsonb;
  END IF;
  v_event_weight := COALESCE((v_weights ->> COALESCE(v_lead.signal_type,'default'))::numeric, (v_weights ->> 'default')::numeric, 2.0);
  v_signal_strength := COALESCE(v_lead.signal_count::numeric, 1.0);
  v_days := GREATEST(0, EXTRACT(EPOCH FROM (now() - COALESCE(v_lead.last_signal_at, v_lead.created_at)))/86400.0);
  v_decay := v_days * COALESCE((v_weights ->> 'decay_per_day')::numeric, 0.05);
  v_score := GREATEST(0, (v_event_weight * LEAST(v_signal_strength, 5.0)) - v_decay);
  UPDATE public.mortgage_radar_leads SET intent_score = round(v_score::numeric, 2), intent_score_updated_at = now() WHERE id = _lead_id;
  RETURN round(v_score::numeric, 2);
END;
$$;

-- ============================================================================
-- 5. AUDIT TRIGGERS
-- ============================================================================
CREATE OR REPLACE FUNCTION public.audit_walker_config_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.key = 'daily_budget_usd' AND (OLD.value_numeric IS DISTINCT FROM NEW.value_numeric) THEN
    INSERT INTO public.admin_decision_audit (actor_user_id, action_type, target_table, target_id, before_value, after_value)
    VALUES (auth.uid(), 'budget_cap_change', 'enrichment_walker_config', NEW.key,
            jsonb_build_object('value_numeric', OLD.value_numeric),
            jsonb_build_object('value_numeric', NEW.value_numeric));
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_audit_walker_config ON public.enrichment_walker_config;
CREATE TRIGGER trg_audit_walker_config AFTER UPDATE ON public.enrichment_walker_config
FOR EACH ROW EXECUTE FUNCTION public.audit_walker_config_change();

CREATE OR REPLACE FUNCTION public.audit_dlq_transition()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (TG_OP = 'INSERT') OR (OLD.permanent_failure IS DISTINCT FROM NEW.permanent_failure) THEN
    INSERT INTO public.admin_decision_audit (actor_user_id, action_type, target_table, target_id, before_value, after_value)
    VALUES (auth.uid(), 'dlq_state_change', 'enrichment_dead_letter', NEW.id::text,
            CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE jsonb_build_object('permanent_failure', OLD.permanent_failure, 'attempt_count', OLD.attempt_count) END,
            jsonb_build_object('permanent_failure', NEW.permanent_failure, 'attempt_count', NEW.attempt_count, 'stage', NEW.stage, 'last_error', LEFT(COALESCE(NEW.last_error,''), 500)));
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_audit_dlq_transition ON public.enrichment_dead_letter;
CREATE TRIGGER trg_audit_dlq_transition AFTER INSERT OR UPDATE ON public.enrichment_dead_letter
FOR EACH ROW EXECUTE FUNCTION public.audit_dlq_transition();

-- ============================================================================
-- 6. SEED intent_weights config row
-- ============================================================================
INSERT INTO public.enrichment_walker_config (key, value_text, updated_at)
VALUES ('intent_weights', '{"divorce":4.0,"probate":4.5,"fsbo":3.0,"foreclosure":5.0,"default":2.0,"decay_per_day":0.05}', now())
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- 7. CRON SCHEDULES
-- ============================================================================
SELECT cron.schedule(
  'quarantine-daily-report', '0 11 * * *',
  $$select net.http_post(url:='https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/quarantine-daily-report', headers:='{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVhdXZ1YmZwYW5wZXV4c3JxZXN1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2MzI3MDYsImV4cCI6MjA4OTIwODcwNn0.QF4PaTIhhwBkl0hgh68W4R2CxH22ReokGwJUebI2tKw"}'::jsonb, body:='{}'::jsonb) as request_id$$
)
WHERE NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname='quarantine-daily-report');

SELECT cron.schedule(
  'edge-function-health-check', '*/15 * * * *',
  $$select net.http_post(url:='https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/edge-function-health-check', headers:='{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVhdXZ1YmZwYW5wZXV4c3JxZXN1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2MzI3MDYsImV4cCI6MjA4OTIwODcwNn0.QF4PaTIhhwBkl0hgh68W4R2CxH22ReokGwJUebI2tKw"}'::jsonb, body:='{}'::jsonb) as request_id$$
)
WHERE NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname='edge-function-health-check');

SELECT cron.schedule(
  'intent-score-decay', '0 10 * * *',
  $$select net.http_post(url:='https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/intent-score-decay', headers:='{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVhdXZ1YmZwYW5wZXV4c3JxZXN1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2MzI3MDYsImV4cCI6MjA4OTIwODcwNn0.QF4PaTIhhwBkl0hgh68W4R2CxH22ReokGwJUebI2tKw"}'::jsonb, body:='{}'::jsonb) as request_id$$
)
WHERE NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname='intent-score-decay');