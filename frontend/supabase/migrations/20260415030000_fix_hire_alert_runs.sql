-- Fix: create hire_alert_runs table which was never created because the original
-- migration (20260410300000_hire_alert_tables.sql) failed during cron.schedule
-- (used broken current_setting('app.supabase_url') pattern), rolling back the
-- entire transaction and leaving the table absent from the DB.

CREATE TABLE IF NOT EXISTS public.hire_alert_runs (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  run_at         timestamptz NOT NULL DEFAULT now(),
  source         text,
  candidates_found integer   NOT NULL DEFAULT 0,
  new_candidates  integer    NOT NULL DEFAULT 0,
  alerts_sent     integer    NOT NULL DEFAULT 0,
  errors          jsonb
);

ALTER TABLE public.hire_alert_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_hire_alert_runs"
  ON public.hire_alert_runs FOR ALL
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "admin_all_hire_alert_runs"
  ON public.hire_alert_runs FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
