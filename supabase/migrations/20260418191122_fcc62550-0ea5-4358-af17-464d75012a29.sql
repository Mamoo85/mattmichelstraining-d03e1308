-- ROOT CAUSE: cron.job_run_details is 598MB / 126K rows, owned by supabase_admin (we can't index, vacuum, or prune it).
-- Every query against it hits the 3s PostgREST timeout.
-- FIX: Stop querying it. cron.job is tiny (~100 rows) and instant. The Sentinel's output-table check
-- already proves whether a cron actually ran successfully; checking last_run is redundant.

CREATE OR REPLACE FUNCTION public.cron_job_status(p_jobname text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'cron'
AS $function$
DECLARE
  v_active boolean;
  v_jobid bigint;
  v_schedule text;
BEGIN
  SET LOCAL statement_timeout = '2s';

  SELECT j.active, j.jobid, j.schedule INTO v_active, v_jobid, v_schedule
  FROM cron.job j WHERE j.jobname = p_jobname LIMIT 1;

  IF v_jobid IS NULL THEN
    RETURN jsonb_build_object('active', false, 'last_run', null, 'exists', false, 'schedule', null);
  END IF;

  -- Return null for last_run; the Sentinel will fall back to output-table freshness or agent_heartbeats
  RETURN jsonb_build_object('active', v_active, 'last_run', null, 'exists', true, 'schedule', v_schedule);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('active', false, 'last_run', null, 'exists', false, 'error', SQLERRM);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.cron_job_status(text) TO anon, authenticated, service_role;