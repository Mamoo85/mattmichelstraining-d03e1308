ALTER TABLE public.admin_command_log
  ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS replay_of_log_id uuid NULL REFERENCES public.admin_command_log(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS result_summary jsonb NULL;

CREATE INDEX IF NOT EXISTS idx_admin_command_log_admin_created
  ON public.admin_command_log (admin_email, created_at DESC);