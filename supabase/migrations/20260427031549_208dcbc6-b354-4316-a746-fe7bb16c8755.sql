ALTER TABLE public.mortgage_radar_clients
  ADD COLUMN IF NOT EXISTS dob date,
  ADD COLUMN IF NOT EXISTS tcpa_consent_at timestamptz,
  ADD COLUMN IF NOT EXISTS manual_ack_at timestamptz;