
CREATE TABLE IF NOT EXISTS public.system_telemetry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name text NOT NULL,
  job_type text NOT NULL DEFAULT 'edge_function',
  status text NOT NULL DEFAULT 'running',
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  duration_ms integer,
  error_message text,
  error_stack text,
  result jsonb,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_system_telemetry_job_name_started ON public.system_telemetry (job_name, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_telemetry_status ON public.system_telemetry (status, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_telemetry_started_at ON public.system_telemetry (started_at DESC);

ALTER TABLE public.system_telemetry ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_system_telemetry" ON public.system_telemetry;
CREATE POLICY "service_role_all_system_telemetry" ON public.system_telemetry
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "admin_read_system_telemetry" ON public.system_telemetry;
CREATE POLICY "admin_read_system_telemetry" ON public.system_telemetry
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
