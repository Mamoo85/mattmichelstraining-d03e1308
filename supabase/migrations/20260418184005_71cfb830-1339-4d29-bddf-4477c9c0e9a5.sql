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
  SET LOCAL statement_timeout = '3s';

  SELECT j.active, j.jobid INTO v_active, v_jobid
  FROM cron.job j WHERE j.jobname = p_jobname LIMIT 1;

  IF v_jobid IS NULL THEN
    RETURN jsonb_build_object('active', false, 'last_run', null, 'exists', false);
  END IF;

  SELECT d.start_time INTO v_last_run
  FROM cron.job_run_details d
  WHERE d.jobid = v_jobid
  ORDER BY d.start_time DESC
  LIMIT 1;

  RETURN jsonb_build_object('active', v_active, 'last_run', v_last_run, 'exists', true);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('active', false, 'last_run', null, 'exists', false, 'error', SQLERRM);
END;
$function$;