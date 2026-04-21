-- ============================================================
-- CRON SAFETY LAYER
-- ============================================================

-- 1. History table: every schedule change archived here
CREATE TABLE IF NOT EXISTS public.cron_schedule_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  jobname text NOT NULL,
  schedule text NOT NULL,
  command text NOT NULL,
  replaced_at timestamptz NOT NULL DEFAULT now(),
  replaced_by text NOT NULL DEFAULT current_user,
  active boolean NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_cron_schedule_history_jobname ON public.cron_schedule_history(jobname, replaced_at DESC);
CREATE INDEX IF NOT EXISTS idx_cron_schedule_history_active ON public.cron_schedule_history(jobname) WHERE active = true;

ALTER TABLE public.cron_schedule_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view cron schedule history"
  ON public.cron_schedule_history FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role full access cron_schedule_history"
  ON public.cron_schedule_history FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- 2. Health tracking table
CREATE TABLE IF NOT EXISTS public.cron_job_health (
  jobname text PRIMARY KEY,
  last_success_at timestamptz,
  last_failure_at timestamptz,
  last_error text,
  next_run_at timestamptz,
  consecutive_failures int NOT NULL DEFAULT 0,
  total_runs int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cron_job_health ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view cron job health"
  ON public.cron_job_health FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role full access cron_job_health"
  ON public.cron_job_health FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- 3. safe_cron_schedule wrapper — rejects bad patterns, archives prior version
CREATE OR REPLACE FUNCTION public.safe_cron_schedule(
  p_jobname text,
  p_schedule text,
  p_command text
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing record;
  v_job_id bigint;
  v_bearer_pos int;
  v_bearer_token text;
BEGIN
  -- Validate inputs
  IF p_jobname IS NULL OR p_jobname = '' THEN
    RAISE EXCEPTION 'safe_cron_schedule: jobname required';
  END IF;
  IF p_schedule IS NULL OR p_schedule = '' THEN
    RAISE EXCEPTION 'safe_cron_schedule: schedule required';
  END IF;
  IF p_command IS NULL OR p_command = '' THEN
    RAISE EXCEPTION 'safe_cron_schedule: command required';
  END IF;

  -- 🚨 BAN forbidden patterns
  IF p_command ILIKE '%current_setting(''app.supabase_url''%' THEN
    RAISE EXCEPTION 'safe_cron_schedule: forbidden pattern current_setting(app.supabase_url) — returns NULL in pg_cron context';
  END IF;
  IF p_command ILIKE '%vault.decrypted_secrets%name%=%''SUPABASE_URL''%' THEN
    RAISE EXCEPTION 'safe_cron_schedule: forbidden vault lookup for SUPABASE_URL — does not exist in vault';
  END IF;
  IF p_command ILIKE '%vault.decrypted_secrets%name%=%''SUPABASE_SERVICE_ROLE_KEY''%' THEN
    RAISE EXCEPTION 'safe_cron_schedule: forbidden vault lookup for SUPABASE_SERVICE_ROLE_KEY — does not exist in vault';
  END IF;
  IF p_command ~* 'url\s*:?=\s*NULL' THEN
    RAISE EXCEPTION 'safe_cron_schedule: literal NULL substituted into url := — would crash http_request_queue';
  END IF;
  IF p_command ~* 'Authorization[^,]*Bearer\s+NULL' OR p_command ~* 'Bearer\s*''\s*''' THEN
    RAISE EXCEPTION 'safe_cron_schedule: empty/NULL Authorization Bearer header';
  END IF;

  -- ✅ REQUIRE canonical hardcoded URL (only enforce for http_post crons)
  IF p_command ILIKE '%net.http_post%' THEN
    IF p_command NOT ILIKE '%https://eauvubfpanpeuxsrqesu.supabase.co%' THEN
      RAISE EXCEPTION 'safe_cron_schedule: http_post command missing canonical URL https://eauvubfpanpeuxsrqesu.supabase.co';
    END IF;

    -- Validate Bearer token length ≥ 100 chars
    v_bearer_pos := position('Bearer ' in p_command);
    IF v_bearer_pos = 0 THEN
      RAISE EXCEPTION 'safe_cron_schedule: http_post command missing Authorization Bearer header';
    END IF;
    v_bearer_token := substring(p_command from v_bearer_pos + 7 for 200);
    -- Strip at first non-JWT char (JWT = base64url + dots)
    v_bearer_token := substring(v_bearer_token from '^([A-Za-z0-9_\-\.]+)');
    IF v_bearer_token IS NULL OR length(v_bearer_token) < 100 THEN
      RAISE EXCEPTION 'safe_cron_schedule: Bearer token too short (got %) — likely NULL or empty', length(coalesce(v_bearer_token, ''));
    END IF;
  END IF;

  -- Archive existing job (if any)
  SELECT jobname, schedule, command INTO v_existing
  FROM cron.job WHERE jobname = p_jobname LIMIT 1;

  IF FOUND THEN
    -- Mark all prior history rows for this job inactive
    UPDATE public.cron_schedule_history SET active = false WHERE jobname = p_jobname AND active = true;
    -- Archive the currently-scheduled version
    INSERT INTO public.cron_schedule_history (jobname, schedule, command, active)
    VALUES (v_existing.jobname, v_existing.schedule, v_existing.command, false);
    -- Unschedule
    PERFORM cron.unschedule(p_jobname);
  END IF;

  -- Schedule the new version
  v_job_id := cron.schedule(p_jobname, p_schedule, p_command);

  -- Insert new active history row
  INSERT INTO public.cron_schedule_history (jobname, schedule, command, active)
  VALUES (p_jobname, p_schedule, p_command, true);

  RETURN v_job_id;
END;
$$;

-- 4. rollback_cron — restore most recent inactive version
CREATE OR REPLACE FUNCTION public.rollback_cron(p_jobname text)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prev record;
  v_job_id bigint;
BEGIN
  -- Find most recent inactive version
  SELECT schedule, command INTO v_prev
  FROM public.cron_schedule_history
  WHERE jobname = p_jobname AND active = false
  ORDER BY replaced_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'rollback_cron: no prior version found for %', p_jobname;
  END IF;

  -- safe_cron_schedule will archive current + insert restored version
  v_job_id := public.safe_cron_schedule(p_jobname, v_prev.schedule, v_prev.command);
  RETURN v_job_id;
END;
$$;

-- 5. Grant execute on rollback to authenticated (admin check happens in edge function)
REVOKE ALL ON FUNCTION public.safe_cron_schedule(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rollback_cron(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.safe_cron_schedule(text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.rollback_cron(text) TO service_role;