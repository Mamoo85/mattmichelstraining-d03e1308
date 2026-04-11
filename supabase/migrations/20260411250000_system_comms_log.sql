-- Phase 4: system_comms_log + revenue automation tables

-- ── UNIFIED COMMS LOG ─────────────────────────────────────────────────────────
-- Single timeline view of all outbound SMS + email across all products.
-- SMS is written directly from _shared/twilio.ts.
-- Email is auto-synced via DB trigger on email_send_log.

CREATE TABLE IF NOT EXISTS system_comms_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel text NOT NULL CHECK (channel IN ('sms', 'email')),
  product text,
  recipient text NOT NULL,
  subject text,
  body_preview text,
  status text NOT NULL DEFAULT 'sent',
  error_message text,
  provider_id text,         -- Twilio SID or Resend message ID
  edge_function text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE system_comms_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON system_comms_log
  FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX idx_comms_log_created   ON system_comms_log(created_at DESC);
CREATE INDEX idx_comms_log_product   ON system_comms_log(product);
CREATE INDEX idx_comms_log_channel   ON system_comms_log(channel, created_at DESC);
CREATE INDEX idx_comms_log_recipient ON system_comms_log(recipient, created_at DESC);

-- Auto-sync email_send_log → system_comms_log (zero changes to 40+ email functions)
CREATE OR REPLACE FUNCTION sync_email_to_comms_log()
RETURNS trigger AS $$
BEGIN
  INSERT INTO system_comms_log (channel, recipient, product, status, metadata, error_message, created_at)
  VALUES (
    'email',
    NEW.recipient_email,
    NEW.template_name,
    NEW.status,
    jsonb_build_object('message_id', NEW.message_id, 'email_log_id', NEW.id),
    NEW.error_message,
    NEW.created_at
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_email_to_comms_log ON email_send_log;
CREATE TRIGGER trg_email_to_comms_log
  AFTER INSERT ON email_send_log
  FOR EACH ROW EXECUTE FUNCTION sync_email_to_comms_log();

-- ── AGED LEAD FLAG ────────────────────────────────────────────────────────────
-- is_aged marks leads that have been unsold for 48h and sent to wider pool at $15
ALTER TABLE contractor_leads ADD COLUMN IF NOT EXISTS is_aged boolean DEFAULT false;

-- ── MISSED CALL CLIENTS ───────────────────────────────────────────────────────
-- Stub table for the Missed-Call Text-Back $99/mo product (no checkout yet)
CREATE TABLE IF NOT EXISTS missed_call_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_phone text NOT NULL UNIQUE,
  client_name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE missed_call_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON missed_call_clients
  FOR ALL USING (true) WITH CHECK (true);

-- ── CRON: AGED LEAD DOWNSELL ─────────────────────────────────────────────────
-- Daily at 2pm ET: blast 48h unsold leads to wider contractor pool at $15
SELECT cron.schedule(
  'contractor-aged-lead-downsell',
  '0 19 * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/contractor-aged-lead-downsell',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body := '{}'::jsonb
  )
  $$
);
