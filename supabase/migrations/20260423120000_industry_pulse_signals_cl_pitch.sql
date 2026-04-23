-- Track when a new_business signal was pitched as a Contractor Leads prospect
ALTER TABLE industry_pulse_signals
  ADD COLUMN IF NOT EXISTS pitched_contractor_leads_at timestamptz;
