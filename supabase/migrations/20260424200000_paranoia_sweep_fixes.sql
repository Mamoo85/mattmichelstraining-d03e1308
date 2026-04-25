-- Paranoia Sweep fixes — 2026-04-24
-- Adds email_sent_at to marketplace_lead_locks so reconcile cron can detect
-- leads marked sold but where the buyer dossier email was never delivered.

ALTER TABLE marketplace_lead_locks
  ADD COLUMN IF NOT EXISTS email_sent_at timestamptz;

-- Index to make the reconcile cron's query fast
CREATE INDEX IF NOT EXISTS idx_marketplace_lead_locks_unsent
  ON marketplace_lead_locks (sold_at)
  WHERE status = 'sold' AND email_sent_at IS NULL;
