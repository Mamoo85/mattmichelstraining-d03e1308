CREATE TABLE IF NOT EXISTS public.admin_command_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_email   text NOT NULL,
  prompt        text NOT NULL,
  plan_json     jsonb,
  steps         jsonb DEFAULT '[]'::jsonb,
  tools_used    text[] DEFAULT ARRAY[]::text[],
  rows_returned integer DEFAULT 0,
  web_calls     integer DEFAULT 0,
  total_cost_usd numeric(10,5) DEFAULT 0,
  draft_output  jsonb,
  user_action   text DEFAULT 'pending',
  brand         text DEFAULT 'DWA',
  error_message text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_command_log_email_created_idx
  ON public.admin_command_log (admin_email, created_at DESC);

ALTER TABLE public.admin_command_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_role_all ON public.admin_command_log;
CREATE POLICY service_role_all ON public.admin_command_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS admin_select_own ON public.admin_command_log;
CREATE POLICY admin_select_own ON public.admin_command_log
  FOR SELECT TO authenticated
  USING (admin_email = auth.email());