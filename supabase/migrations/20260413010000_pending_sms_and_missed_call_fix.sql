-- pending_sms: queue for delayed outbound SMS (used by missed-call 5-min delay)
CREATE TABLE IF NOT EXISTS pending_sms (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  to_phone    text NOT NULL,
  from_phone  text NOT NULL,
  body        text NOT NULL,
  product     text,
  send_after  timestamptz NOT NULL,
  sent        boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE pending_sms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON pending_sms
  FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS pending_sms_unsent_idx
  ON pending_sms (send_after)
  WHERE sent = false;

-- missed_call_clients: add missing columns that stripe-webhook expects
ALTER TABLE missed_call_clients
  ADD COLUMN IF NOT EXISTS contact_name          text,
  ADD COLUMN IF NOT EXISTS twilio_number         text,
  ADD COLUMN IF NOT EXISTS call_count            integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS text_count            integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text;

-- Cron: process-pending-sms — runs every minute, delivers queued texts
SELECT cron.schedule(
  'process-pending-sms',
  '* * * * *',
  $$SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/process-pending-sms',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')),
    body := '{}'::jsonb)$$
) ON CONFLICT (jobname) DO UPDATE SET schedule = EXCLUDED.schedule, command = EXCLUDED.command;
