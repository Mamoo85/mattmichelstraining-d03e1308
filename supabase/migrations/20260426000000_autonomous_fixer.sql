-- Autonomous Code-Fixer Agent tables, trigger, and cron.
-- fixer_queue: one row per error that needs a fix attempt.
-- fixer_runs:  one row per watchdog execution (audit trail).
-- pg trigger:  fires watchdog immediately on any error/critical log insert.
-- pg_cron:     sweeps every 15 minutes as a safety net.

-- ── fixer_queue ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fixer_queue (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  error_log_id   UUID,
  source         TEXT        NOT NULL,
  function_name  TEXT,
  error_message  TEXT        NOT NULL,
  fix_category   TEXT,
  -- retry_email | retry_sms | retry_function | restart_cron | clear_stale_lock | unknown
  status         TEXT        NOT NULL DEFAULT 'queued'
                 CHECK (status IN ('queued','in_progress','fixed','failed','escalated')),
  attempts       INT         NOT NULL DEFAULT 0,
  fix_applied    TEXT,
  result_message TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at    TIMESTAMPTZ
);

ALTER TABLE public.fixer_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role bypass fixer_queue"
  ON public.fixer_queue FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_fixer_queue_status
  ON public.fixer_queue (status, created_at DESC);

-- ── fixer_runs ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fixer_runs (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  triggered_by     TEXT        NOT NULL,
  -- cron | pg_trigger | sms_command | manual
  errors_found     INT         NOT NULL DEFAULT 0,
  errors_fixed     INT         NOT NULL DEFAULT 0,
  errors_failed    INT         NOT NULL DEFAULT 0,
  errors_escalated INT         NOT NULL DEFAULT 0,
  summary          TEXT,
  started_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at     TIMESTAMPTZ
);

ALTER TABLE public.fixer_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role bypass fixer_runs"
  ON public.fixer_runs FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ── Postgres trigger: fire watchdog on every error/critical log insert ────────
CREATE OR REPLACE FUNCTION public.notify_fixer_on_error()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.severity IN ('error', 'critical') THEN
    PERFORM net.http_post(
      url     := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL')
                 || '/functions/v1/code-fixer-watchdog',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')
      ),
      body    := jsonb_build_object('trigger', 'pg_trigger', 'error_id', NEW.id::text)
    );
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trigger_fixer_on_error ON public.error_logs;
CREATE TRIGGER trigger_fixer_on_error
  AFTER INSERT ON public.error_logs
  FOR EACH ROW EXECUTE FUNCTION public.notify_fixer_on_error();

-- ── pg_cron: sweep every 15 minutes ─────────────────────────────────────────
DO $$ BEGIN
  PERFORM cron.unschedule('code-fixer-watchdog-15min');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'code-fixer-watchdog-15min',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url     := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL')
               || '/functions/v1/code-fixer-watchdog',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')
    ),
    body    := '{"trigger":"cron"}'::jsonb
  );
  $$
);

-- Seed agent_heartbeats row for fixer so oz-autonomous can detect drift
INSERT INTO public.agent_heartbeats (agent_name, last_beat, metadata)
VALUES ('fixer', now(), '{"schedule":"*/15 * * * *"}'::jsonb)
ON CONFLICT (agent_name) DO NOTHING;
