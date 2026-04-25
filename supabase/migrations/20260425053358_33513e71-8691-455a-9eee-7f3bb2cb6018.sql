-- Engine heartbeat log: per-execution footprint for every Ingestion Pipeline
CREATE TABLE IF NOT EXISTS public.engine_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline text NOT NULL,
  run_id uuid NOT NULL DEFAULT gen_random_uuid(),
  status text NOT NULL CHECK (status IN ('started','success','partial','failed')),
  records_processed integer NOT NULL DEFAULT 0,
  records_failed integer NOT NULL DEFAULT 0,
  duration_ms integer,
  error_message text,
  metadata jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_engine_logs_pipeline_started
  ON public.engine_logs (pipeline, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_engine_logs_failed
  ON public.engine_logs (started_at DESC)
  WHERE status IN ('failed','partial');

CREATE INDEX IF NOT EXISTS idx_engine_logs_run_id
  ON public.engine_logs (run_id);

ALTER TABLE public.engine_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_read_engine_logs"
  ON public.engine_logs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "service_role_full_engine_logs"
  ON public.engine_logs
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Dead-letter queue columns on existing comms log
ALTER TABLE public.system_comms_log
  ADD COLUMN IF NOT EXISTS requires_retry boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS retry_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_retry_at timestamptz,
  ADD COLUMN IF NOT EXISTS retry_payload jsonb;

CREATE INDEX IF NOT EXISTS idx_comms_retry_pending
  ON public.system_comms_log (created_at)
  WHERE requires_retry = true AND retry_count < 5;