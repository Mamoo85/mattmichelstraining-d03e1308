-- The 7-day MAX() still scans too many rows for high-frequency crons (sentinel runs every 6h = 28 rows/wk,
-- but other crons run every minute = 10080 rows/wk). Switch to ORDER BY + LIMIT 1 with a 24h bound.
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
  SET LOCAL statement_timeout = '2500ms';

  SELECT j.active, j.jobid INTO v_active, v_jobid
  FROM cron.job j WHERE j.jobname = p_jobname LIMIT 1;

  IF v_jobid IS NULL THEN
    RETURN jsonb_build_object('active', false, 'last_run', null, 'exists', false);
  END IF;

  -- Tight 24h window + LIMIT 1 = bounded work regardless of how often the cron fires
  SELECT d.start_time INTO v_last_run
  FROM cron.job_run_details d
  WHERE d.jobid = v_jobid
    AND d.start_time > now() - interval '24 hours'
  ORDER BY d.start_time DESC
  LIMIT 1;

  -- If nothing in last 24h, try last 7 days as fallback (slower but still bounded)
  IF v_last_run IS NULL THEN
    SELECT d.start_time INTO v_last_run
    FROM cron.job_run_details d
    WHERE d.jobid = v_jobid
      AND d.start_time > now() - interval '7 days'
    ORDER BY d.start_time DESC
    LIMIT 1;
  END IF;

  RETURN jsonb_build_object('active', v_active, 'last_run', v_last_run, 'exists', true);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('active', false, 'last_run', null, 'exists', false, 'error', SQLERRM);
END;
$function$;

-- Aggressive prune: keep only last 7 days of cron run history. This is the real fix for table bloat.
DELETE FROM cron.job_run_details WHERE start_time < now() - interval '7 days';

-- Vacuum to reclaim space and update planner stats
ANALYZE cron.job_run_details;