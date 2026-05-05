DO $migration$
BEGIN
  PERFORM cron.unschedule('industry-pulse-commercial-3am-et')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'industry-pulse-commercial-3am-et');

  PERFORM cron.schedule(
    'industry-pulse-commercial-3am-et',
    '0 7 * * *',
    $command$
      SELECT net.http_post(
        url := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/industry-pulse-scanner',
        headers := jsonb_build_object(
          'Content-Type','application/json',
          'Authorization','Bearer ' || (
            SELECT decrypted_secret
            FROM vault.decrypted_secrets
            WHERE name = 'SUPABASE_SERVICE_ROLE_KEY_VAULT'
            LIMIT 1
          )
        ),
        body := jsonb_build_object('triggered_by','cron_round_robin')
      );
    $command$
  );
END
$migration$;

UPDATE public.cron_schedule_history
SET active = false
WHERE jobname IN ('industry-pulse-commercial-3am-et', 'techalert-prospect-hunter-daily', 'techalert-prospect-hunter-3x')
  AND active = true;

INSERT INTO public.cron_schedule_history (jobname, schedule, command, replaced_by, active)
SELECT jobname, schedule, command, 'lovable_fix_cron_alerts', true
FROM cron.job
WHERE jobname IN ('industry-pulse-commercial-3am-et', 'techalert-prospect-hunter-3x');

UPDATE public.cron_job_health
SET last_error = NULL,
    consecutive_failures = 0,
    updated_at = now()
WHERE jobname IN ('industry-pulse-commercial-3am-et', 'techalert-prospect-hunter-daily', 'techalert-prospect-hunter-3x');