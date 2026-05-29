-- pod_audit_state: tracks rolling audit progress
CREATE TABLE IF NOT EXISTS pod_audit_state (
  id text PRIMARY KEY DEFAULT 'singleton',
  last_offset integer DEFAULT 0,
  last_run_at timestamptz,
  last_summary jsonb
);

-- pod_audit_log: records every QC action taken
CREATE TABLE IF NOT EXISTS pod_audit_log (
  id bigserial PRIMARY KEY,
  checked_at timestamptz DEFAULT now(),
  product_id text,
  product_title text,
  blueprint_id integer,
  issues jsonb,
  actions_taken jsonb,
  image_score integer
);

CREATE INDEX IF NOT EXISTS pod_audit_log_product_id_idx ON pod_audit_log(product_id);
CREATE INDEX IF NOT EXISTS pod_audit_log_checked_at_idx ON pod_audit_log(checked_at);

-- pod-audit: daily 5pm UTC
SELECT cron.unschedule('pod-audit-daily')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'pod-audit-daily');
SELECT cron.schedule('pod-audit-daily', '0 17 * * *', $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/pod-audit',
    headers := jsonb_build_object('Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY_VAULT'), 'Content-Type', 'application/json'),
    body := '{"audit":true,"offset":0}'::jsonb
  )
$$);

-- pod-holiday-boost: 1st of month 6am UTC
SELECT cron.unschedule('pod-holiday-boost-monthly')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'pod-holiday-boost-monthly');
SELECT cron.schedule('pod-holiday-boost-monthly', '0 6 1 * *', $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/pod-holiday-boost',
    headers := jsonb_build_object('Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY_VAULT'), 'Content-Type', 'application/json'),
    body := '{}'::jsonb
  )
$$);

-- pod-tag-refresh: Mondays 7am UTC
SELECT cron.unschedule('pod-tag-refresh-weekly')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'pod-tag-refresh-weekly');
SELECT cron.schedule('pod-tag-refresh-weekly', '0 7 * * 1', $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/pod-tag-refresh',
    headers := jsonb_build_object('Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY_VAULT'), 'Content-Type', 'application/json'),
    body := '{"offset":0}'::jsonb
  )
$$);

-- pod-seasonal-scheduler: daily 8am UTC
SELECT cron.unschedule('pod-seasonal-scheduler-daily')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'pod-seasonal-scheduler-daily');
SELECT cron.schedule('pod-seasonal-scheduler-daily', '0 8 * * *', $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/pod-seasonal-scheduler',
    headers := jsonb_build_object('Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY_VAULT'), 'Content-Type', 'application/json'),
    body := '{}'::jsonb
  )
$$);
