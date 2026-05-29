-- Add hot_notified_at to hire_alert_candidates so the hot-notify cron tracks sends
ALTER TABLE public.hire_alert_candidates
  ADD COLUMN IF NOT EXISTS hot_notified_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_hire_REDACTED
  ON public.hire_alert_candidates (score, hot_notified_at)
  WHERE hot_notified_at IS NULL;

-- Schedule techalert-hot-candidate-notify every 2 hours
DO $$ BEGIN PERFORM cron.unschedule('techalert-hot-candidate-2h'); EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule('techalert-hot-candidate-2h', '0 */2 * * *', $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/techalert-hot-candidate-notify',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')
    ),
    body := '{}'::jsonb
  );
$$);
