-- Track when a new_business signal was pitched as a Mortgage Radar lead
-- Prevents the same new LLC from appearing in every daily scan.
ALTER TABLE industry_pulse_signals
  ADD COLUMN IF NOT EXISTS pitched_mortgage_radar_at TIMESTAMPTZ;
