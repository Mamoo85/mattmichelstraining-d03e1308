-- Drop existing functions to allow return-type changes
DROP FUNCTION IF EXISTS public.safe_cron_schedule(text, text, text);
DROP FUNCTION IF EXISTS public.rollback_cron(text);

-- Audit log table
CREATE TABLE IF NOT EXISTS public.cron_schedule_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  jobname text NOT NULL,
  schedule text,
  command text,
  attempted_by text,
  outcome text NOT NULL CHECK (outcome IN ('success','rejected','rolled_back','pending')),
  error_rule text,
  error_message text,
  mode text NOT NULL CHECK (mode IN ('schedule','validate','rollback')) DEFAULT 'schedule',
  attempted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cron_audit_attempted_at ON public.cron_schedule_audit (attempted_at DESC);
CREATE INDEX IF NOT EXISTS idx_cron_audit_jobname ON public.cron_schedule_audit (jobname);

ALTER TABLE public.cron_schedule_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins read cron audit" ON public.cron_schedule_audit;
CREATE POLICY "admins read cron audit" ON public.cron_schedule_audit
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "service role full cron audit" ON public.cron_schedule_audit;
CREATE POLICY "service role full cron audit" ON public.cron_schedule_audit
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

ALTER TABLE public.cron_job_health
  ADD COLUMN IF NOT EXISTS expected_interval_minutes int,
  ADD COLUMN IF NOT EXISTS stale_after_minutes int;

CREATE OR REPLACE FUNCTION public._validate_cron_command(
  p_jobname text,
  p_schedule text,
  p_command text
) RETURNS TABLE(ok boolean, error_msg text, rule text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_jobname IS NULL OR length(trim(p_jobname)) = 0 THEN
    RETURN QUERY SELECT false, 'jobname is empty'::text, 'jobname_empty'::text; RETURN;
  END IF;
  IF p_schedule IS NULL OR length(trim(p_schedule)) = 0 THEN
    RETURN QUERY SELECT false, 'schedule is empty'::text, 'schedule_empty'::text; RETURN;
  END IF;
  IF array_length(regexp_split_to_array(trim(p_schedule), '\s+'), 1) <> 5 THEN
    RETURN QUERY SELECT false, format('schedule must be 5 fields, got: %s', p_schedule), 'schedule_format'::text; RETURN;
  END IF;
  IF p_command IS NULL OR length(trim(p_command)) = 0 THEN
    RETURN QUERY SELECT false, 'command is empty'::text, 'command_empty'::text; RETURN;
  END IF;
  IF p_command ILIKE '%current_setting(%app.supabase_url%' THEN
    RETURN QUERY SELECT false, 'forbidden: current_setting(app.supabase_url) returns NULL in pg_cron context'::text, 'app_supabase_url'::text; RETURN;
  END IF;
  IF p_command ~* 'vault\.decrypted_secrets[^;]*name\s*=\s*''SUPABASE_URL''' THEN
    RETURN QUERY SELECT false, 'forbidden: vault lookup of SUPABASE_URL — not present in this project vault'::text, 'vault_supabase_url'::text; RETURN;
  END IF;
  IF p_command ~* 'vault\.decrypted_secrets[^;]*name\s*=\s*''SUPABASE_SERVICE_ROLE_KEY''' THEN
    RETURN QUERY SELECT false, 'forbidden: vault lookup of SUPABASE_SERVICE_ROLE_KEY — not present in this project vault'::text, 'vault_service_role_key'::text; RETURN;
  END IF;
  IF p_command ~* 'url\s*:?=\s*NULL' THEN
    RETURN QUERY SELECT false, 'forbidden: literal NULL substituted into url'::text, 'null_url'::text; RETURN;
  END IF;
  IF p_command ~* 'Authorization[^,}]*Bearer\s+NULL' THEN
    RETURN QUERY SELECT false, 'forbidden: literal NULL substituted into Authorization Bearer'::text, 'null_bearer'::text; RETURN;
  END IF;
  IF position('https://eauvubfpanpeuxsrqesu.supabase.co' in p_command) = 0 THEN
    RETURN QUERY SELECT false, 'missing canonical URL https://eauvubfpanpeuxsrqesu.supabase.co'::text, 'missing_canonical_url'::text; RETURN;
  END IF;
  IF p_command !~ 'Bearer\s+eyJ[A-Za-z0-9_\-\.]{100,}' THEN
    RETURN QUERY SELECT false, 'missing or too-short Bearer eyJ... token (need 100+ chars after Bearer)'::text, 'bearer_too_short'::text; RETURN;
  END IF;
  RETURN QUERY SELECT true, NULL::text, NULL::text;
END;
$$;

CREATE OR REPLACE FUNCTION public.safe_cron_validate(
  p_jobname text,
  p_schedule text,
  p_command text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_ok boolean;
  v_err text;
  v_rule text;
  v_existing record;
BEGIN
  SELECT ok, error_msg, rule INTO v_ok, v_err, v_rule
  FROM public._validate_cron_command(p_jobname, p_schedule, p_command);

  INSERT INTO public.cron_schedule_audit (jobname, schedule, command, attempted_by, outcome, error_rule, error_message, mode)
  VALUES (p_jobname, p_schedule, p_command, current_user,
          CASE WHEN v_ok THEN 'success' ELSE 'rejected' END,
          v_rule, v_err, 'validate');

  IF NOT v_ok THEN
    RETURN jsonb_build_object('ok', false, 'error', v_err, 'rule', v_rule);
  END IF;

  SELECT jobname, schedule, command INTO v_existing
  FROM public.cron_schedule_history
  WHERE jobname = p_jobname AND active = true
  LIMIT 1;

  RETURN jsonb_build_object(
    'ok', true,
    'warnings', '[]'::jsonb,
    'would_replace', CASE WHEN v_existing.jobname IS NULL THEN NULL::jsonb
                          ELSE jsonb_build_object('schedule', v_existing.schedule, 'command', v_existing.command)
                     END,
    'new', jsonb_build_object('schedule', p_schedule, 'command', p_command)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.safe_cron_schedule(
  p_jobname text,
  p_schedule text,
  p_command text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_ok boolean;
  v_err text;
  v_rule text;
  v_audit_id uuid;
BEGIN
  INSERT INTO public.cron_schedule_audit (jobname, schedule, command, attempted_by, outcome, mode)
  VALUES (p_jobname, p_schedule, p_command, current_user, 'pending', 'schedule')
  RETURNING id INTO v_audit_id;

  SELECT ok, error_msg, rule INTO v_ok, v_err, v_rule
  FROM public._validate_cron_command(p_jobname, p_schedule, p_command);

  IF NOT v_ok THEN
    UPDATE public.cron_schedule_audit
    SET outcome = 'rejected', error_rule = v_rule, error_message = v_err
    WHERE id = v_audit_id;
    RAISE EXCEPTION 'safe_cron_schedule rejected [%]: %', v_rule, v_err;
  END IF;

  UPDATE public.cron_schedule_history
  SET active = false
  WHERE jobname = p_jobname AND active = true;

  INSERT INTO public.cron_schedule_history (jobname, schedule, command, replaced_by, active)
  VALUES (p_jobname, p_schedule, p_command, current_user, true);

  PERFORM cron.unschedule(p_jobname) WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = p_jobname);
  PERFORM cron.schedule(p_jobname, p_schedule, p_command);

  UPDATE public.cron_schedule_audit
  SET outcome = 'success'
  WHERE id = v_audit_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.rollback_cron(p_jobname text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_prev record;
BEGIN
  SELECT schedule, command INTO v_prev
  FROM public.cron_schedule_history
  WHERE jobname = p_jobname AND active = false
  ORDER BY replaced_at DESC
  LIMIT 1;

  IF v_prev IS NULL THEN
    INSERT INTO public.cron_schedule_audit (jobname, attempted_by, outcome, error_message, mode)
    VALUES (p_jobname, current_user, 'rejected', 'no prior version to roll back to', 'rollback');
    RETURN jsonb_build_object('ok', false, 'error', 'no prior version to roll back to');
  END IF;

  PERFORM public.safe_cron_schedule(p_jobname, v_prev.schedule, v_prev.command);

  INSERT INTO public.cron_schedule_audit (jobname, schedule, command, attempted_by, outcome, mode)
  VALUES (p_jobname, v_prev.schedule, v_prev.command, current_user, 'rolled_back', 'rollback');

  RETURN jsonb_build_object('ok', true, 'restored', jsonb_build_object('schedule', v_prev.schedule, 'command', v_prev.command));
END;
$$;

GRANT EXECUTE ON FUNCTION public.safe_cron_validate(text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public._validate_cron_command(text, text, text) TO service_role;