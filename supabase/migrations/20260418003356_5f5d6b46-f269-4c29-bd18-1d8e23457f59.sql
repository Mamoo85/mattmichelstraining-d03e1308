-- Helper RPC so cron-sentinel edge function can check pg_cron status
-- (cron schema is not directly readable via PostgREST)

CREATE OR REPLACE FUNCTION public.cron_job_status(p_jobname text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron
AS $$
DECLARE
  v_active boolean;
  v_last_run timestamptz;
BEGIN
  SELECT j.active INTO v_active FROM cron.job j WHERE j.jobname = p_jobname LIMIT 1;

  IF v_active IS NULL THEN
    RETURN jsonb_build_object('active', false, 'last_run', null, 'exists', false);
  END IF;

  SELECT MAX(d.start_time) INTO v_last_run
  FROM cron.job_run_details d
  JOIN cron.job j ON j.jobid = d.jobid
  WHERE j.jobname = p_jobname;

  RETURN jsonb_build_object('active', v_active, 'last_run', v_last_run, 'exists', true);
END;
$$;

REVOKE ALL ON FUNCTION public.cron_job_status(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cron_job_status(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.cron_job_status(text) TO authenticated;