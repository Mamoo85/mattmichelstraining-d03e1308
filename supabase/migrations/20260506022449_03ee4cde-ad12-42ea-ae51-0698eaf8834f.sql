-- Safe read-only RPC to fetch the live command for a cron.job by name.
-- Used by cron-zero-output-watchdog so alerts always know the request URL even
-- when cron_schedule_history is out of sync.
CREATE OR REPLACE FUNCTION public.get_cron_job_command(p_jobname text)
RETURNS TABLE(jobname text, schedule text, command text, active boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, cron
AS $$
  SELECT j.jobname, j.schedule, j.command, j.active
  FROM cron.job j
  WHERE j.jobname = p_jobname
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_cron_job_command(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_cron_job_command(text) TO service_role;

-- Reset stale failure state for the Demand Radar / Industry Pulse cron now that
-- it is producing output again.
UPDATE public.cron_job_health
SET last_error = NULL, consecutive_failures = 0, updated_at = now()
WHERE jobname = 'industry-pulse-commercial-3am-et';

-- Make sure cron_schedule_history has the live command on file.
INSERT INTO public.cron_schedule_history (jobname, schedule, command, replaced_by, active)
SELECT j.jobname, j.schedule, j.command, 'watchdog_hardening', true
FROM cron.job j
WHERE j.jobname = 'industry-pulse-commercial-3am-et'
  AND NOT EXISTS (
    SELECT 1 FROM public.cron_schedule_history h
    WHERE h.jobname = j.jobname AND h.active = true AND h.command = j.command
  );

UPDATE public.cron_schedule_history h
SET active = false
WHERE h.jobname = 'industry-pulse-commercial-3am-et'
  AND h.active = true
  AND h.command <> (SELECT j.command FROM cron.job j WHERE j.jobname = h.jobname LIMIT 1);