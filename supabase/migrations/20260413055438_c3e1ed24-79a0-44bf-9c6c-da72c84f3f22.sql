ALTER TABLE hire_alert_clients 
  ADD COLUMN IF NOT EXISTS trial_status text,
  ADD COLUMN IF NOT EXISTS trial_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz;