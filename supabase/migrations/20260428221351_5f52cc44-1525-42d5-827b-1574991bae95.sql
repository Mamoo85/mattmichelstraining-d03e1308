-- Wave 7: Observability, Audit & Operator Tooling

CREATE TABLE IF NOT EXISTS public.enrichment_e2e_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL,
  check_name text NOT NULL,
  status text NOT NULL CHECK (status IN ('pass','fail','degraded','skipped')),
  detail text,
  duration_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_e2e_checks_run ON public.enrichment_e2e_checks(run_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_e2e_checks_created ON public.enrichment_e2e_checks(created_at DESC);
ALTER TABLE public.enrichment_e2e_checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_select_e2e_checks" ON public.enrichment_e2e_checks
  FOR SELECT TO authenticated USING (has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "service_role_all_e2e_checks" ON public.enrichment_e2e_checks
  TO service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.cron_expected_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  jobname text NOT NULL UNIQUE,
  surface text NOT NULL,
  owner text,
  critical boolean NOT NULL DEFAULT false,
  stale_after_minutes integer NOT NULL DEFAULT 1440,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.cron_expected_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_select_expected_jobs" ON public.cron_expected_jobs
  FOR SELECT TO authenticated USING (has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "admin_manage_expected_jobs" ON public.cron_expected_jobs
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "service_role_all_expected_jobs" ON public.cron_expected_jobs
  TO service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.enrichment_decision_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  decided_at timestamptz NOT NULL DEFAULT now(),
  decision_kind text NOT NULL,
  prospect_id uuid,
  surface text,
  reason text,
  context jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_decision_audit_kind_at ON public.enrichment_decision_audit(decision_kind, decided_at DESC);
CREATE INDEX IF NOT EXISTS idx_decision_audit_prospect ON public.enrichment_decision_audit(prospect_id, decided_at DESC) WHERE prospect_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_decision_audit_surface ON public.enrichment_decision_audit(surface, decided_at DESC);
ALTER TABLE public.enrichment_decision_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_select_decision_audit" ON public.enrichment_decision_audit
  FOR SELECT TO authenticated USING (has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "service_role_all_decision_audit" ON public.enrichment_decision_audit
  TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_alerts_log_severity_created ON public.outreach_alerts_log(severity, created_at DESC);

INSERT INTO public.cron_expected_jobs (jobname, surface, owner, critical, stale_after_minutes, notes) VALUES
  ('enrichment-matrix-walker-hourly','enrichment-matrix-walker','enrichment',true,180,'Autonomous walker discovery'),
  ('enrichment-backfill-nightly','contractor-outreach-enrich-backfill','enrichment',true,1500,'DLQ aging + nightly backfill'),
  ('enrichment-cost-rollup-hourly','enrichment-cost-rollup','enrichment',true,180,'Provider spend rollup'),
  ('outreach-alert-evaluator-15m','outreach-alert-evaluator','alerting',true,60,'Threshold + anomaly evaluator'),
  ('enrichment-e2e-verify-nightly','enrichment-e2e-verify','enrichment',true,1500,'Nightly canary smoke suite'),
  ('enrichment-latency-prune-nightly','prune_enrichment_provider_latency','enrichment',false,1500,'Nightly latency pruning'),
  ('cron-health-monitor-15m','cron-health-monitor','alerting',true,30,'Watchdog for missing/failing crons')
ON CONFLICT (jobname) DO UPDATE SET
  surface = EXCLUDED.surface, owner = EXCLUDED.owner, critical = EXCLUDED.critical,
  stale_after_minutes = EXCLUDED.stale_after_minutes, notes = EXCLUDED.notes;