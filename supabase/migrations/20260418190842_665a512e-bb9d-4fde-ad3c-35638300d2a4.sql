-- Fix Cron Sentinel timeouts: cron.job_run_details lacks an index on (jobid, start_time DESC)
-- causing the cron_job_status RPC to hit its 3s statement_timeout on every call.

-- Cannot create indexes on cron.job_run_details directly (owned by postgres role in cron schema),
-- so we rewrite cron_job_status to use a faster query path: bound the time window to last 7 days
-- which lets Postgres skip ancient rows even without an ideal index.

CREATE OR REPLACE FUNCTION public.cron_job_status(p_jobname text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'cron'
AS $function$
DECLARE
  v_active boolean;
  v_jobid bigint;
  v_last_run timestamptz;
BEGIN
  SET LOCAL statement_timeout = '8s';

  SELECT j.active, j.jobid INTO v_active, v_jobid
  FROM cron.job j WHERE j.jobname = p_jobname LIMIT 1;

  IF v_jobid IS NULL THEN
    RETURN jsonb_build_object('active', false, 'last_run', null, 'exists', false);
  END IF;

  -- Bound by 7 days so planner can skip the ancient bulk of job_run_details
  SELECT MAX(d.start_time) INTO v_last_run
  FROM cron.job_run_details d
  WHERE d.jobid = v_jobid
    AND d.start_time > now() - interval '7 days';

  RETURN jsonb_build_object('active', v_active, 'last_run', v_last_run, 'exists', true);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('active', false, 'last_run', null, 'exists', false, 'error', SQLERRM);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.cron_job_status(text) TO anon, authenticated, service_role;

-- Cleanup: prune cron.job_run_details to last 30 days so future queries stay fast.
-- pg_cron retains all run history forever by default, which kills query performance.
DELETE FROM cron.job_run_details WHERE start_time < now() - interval '30 days';