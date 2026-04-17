-- Agent run log for the admin Agent Toolkit
CREATE TABLE IF NOT EXISTS public.agent_run_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_name TEXT NOT NULL,
  triggered_by UUID,
  status TEXT NOT NULL DEFAULT 'running',
  result_count INTEGER,
  result_summary TEXT,
  error_message TEXT,
  duration_ms INTEGER,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_agent_run_log_created_at ON public.agent_run_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_run_log_agent_name ON public.agent_run_log (agent_name);

ALTER TABLE public.agent_run_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view agent run log"
  ON public.agent_run_log FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role manages agent run log"
  ON public.agent_run_log FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);