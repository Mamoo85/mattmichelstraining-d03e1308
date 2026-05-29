-- Fix compliance agent crons + RPC bug
--
-- 1. The comply-monitor-daily cron in 20260407150000_agent_support_tables.sql
--    used current_setting('app.supabase_url') which returns NULL in pg_cron context.
--    Recreate using vault.decrypted_secrets pattern.
--
-- 2. Add mute-compliance-monitor cron (was never scheduled).
--
-- 3. Fix find_opted_out_active_clients RPC: was querying sms_opt_outs.phone_number
--    but the actual column is sms_opt_outs.phone (see 20260404130000_sms_opt_outs.sql).
--
-- 4. Seed mute + comply into agent_heartbeats so health dashboard shows them.

-- ── 1+2. Fix/add compliance crons ────────────────────────────────────────────

DO $$
DECLARE
  jobs text[] := ARRAY['comply-monitor-daily', 'mute-compliance-2h'];
  j text;
BEGIN
  FOREACH j IN ARRAY jobs LOOP
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = j) THEN
      PERFORM cron.unschedule(j);
    END IF;
  END LOOP;
END $$;

-- comply-monitor: daily 11:30am ET = 15:30 UTC
SELECT cron.schedule(
  'comply-monitor-daily',
  '30 15 * * *',
  $$SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/comply-monitor',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')
    ),
    body := '{}'::jsonb
  )$$
) ON CONFLICT (jobname) DO UPDATE SET schedule = EXCLUDED.schedule, command = EXCLUDED.command;

-- mute-compliance-monitor: every 2 hours
SELECT cron.schedule(
  'mute-compliance-2h',
  '0 */2 * * *',
  $$SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/mute-compliance-monitor',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')
    ),
    body := '{}'::jsonb
  )$$
) ON CONFLICT (jobname) DO UPDATE SET schedule = EXCLUDED.schedule, command = EXCLUDED.command;

-- ── 3. Fix find_opted_out_active_clients RPC ─────────────────────────────────
-- Bug: was joining on sms_opt_outs.phone_number — actual column is sms_opt_outs.phone

CREATE OR REPLACE FUNCTION find_opted_out_active_clients(
  p_table     text,
  p_phone_col text
)
RETURNS TABLE(id uuid, phone text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_table NOT IN (
    'sms_blast_clients', 'noshow_clients', 'estimate_drip_clients',
    'invoice_chaser_clients', 'afterjob_drip_clients', 'promo_blaster_clients',
    'referral_program_clients', 'slow_day_clients', 'homeowner_campaign_clients',
    'review_monitor_clients'
  ) THEN
    RAISE EXCEPTION 'Table % is not in the allowed list', p_table;
  END IF;

  IF p_phone_col NOT IN ('phone', 'phone_number') THEN
    RAISE EXCEPTION 'Column % is not in the allowed list', p_phone_col;
  END IF;

  RETURN QUERY EXECUTE format(
    'SELECT c.id, c.%I AS phone
     FROM %I c
     WHERE c.active = true
       AND EXISTS (
         SELECT 1 FROM sms_opt_outs o
         WHERE o.phone = c.%I
       )',
    p_phone_col, p_table, p_phone_col
  );
END;
$$;

REVOKE ALL ON FUNCTION find_opted_out_active_clients(text, text) FROM public;
GRANT EXECUTE ON FUNCTION find_opted_out_active_clients(text, text) TO service_role;

-- ── 4. Seed mute + comply into agent_heartbeats ───────────────────────────────

INSERT INTO agent_heartbeats (agent_name, last_run_at, last_status, detail)
VALUES
  ('mute',   now(), 'ok', 'Initialized — first run pending'),
  ('comply', now(), 'ok', 'Initialized — first run pending')
ON CONFLICT (agent_name) DO NOTHING;
