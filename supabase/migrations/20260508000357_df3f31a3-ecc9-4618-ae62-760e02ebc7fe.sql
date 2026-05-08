ALTER TABLE public.field_crm_clients
  ADD COLUMN IF NOT EXISTS alert_webhook_url text,
  ADD COLUMN IF NOT EXISTS alert_webhook_min_score integer DEFAULT 70,
  ADD COLUMN IF NOT EXISTS install_status text DEFAULT 'not_installed',
  ADD COLUMN IF NOT EXISTS install_platform text;