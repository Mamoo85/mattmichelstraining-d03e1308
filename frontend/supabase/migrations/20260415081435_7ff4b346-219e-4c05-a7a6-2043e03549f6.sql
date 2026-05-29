ALTER TABLE public.hire_alert_clients 
  ADD COLUMN IF NOT EXISTS pricing_tier TEXT DEFAULT 'beta_grandfathered',
  ADD COLUMN IF NOT EXISTS fielddesk_cross_sell_sent BOOLEAN DEFAULT false;