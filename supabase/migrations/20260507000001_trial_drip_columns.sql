-- Add mid-trial drip tracking columns to hire_alert_clients
-- Used by hire-alert-trial-convert to send Day 1/3/6 nurture emails idempotently.
ALTER TABLE hire_alert_clients ADD COLUMN IF NOT EXISTS trial_drip_d1_sent_at TIMESTAMPTZ;
ALTER TABLE hire_alert_clients ADD COLUMN IF NOT EXISTS trial_drip_d3_sent_at TIMESTAMPTZ;
ALTER TABLE hire_alert_clients ADD COLUMN IF NOT EXISTS trial_drip_d6_sent_at TIMESTAMPTZ;
