-- Mortgage Radar first-10-free trial columns

ALTER TABLE public.mortgage_radar_clients
  ADD COLUMN IF NOT EXISTS trial_active boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS trial_leads_remaining integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stripe_payment_method_id text DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_mortgage_radar_clients_trial
  ON public.mortgage_radar_clients (trial_active)
  WHERE trial_active = true;
