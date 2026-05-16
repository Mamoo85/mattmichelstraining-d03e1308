ALTER TABLE public.trade_radar_clients
  ADD COLUMN IF NOT EXISTS is_whitelabel boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS whitelabel_brand text,
  ADD COLUMN IF NOT EXISTS whitelabel_logo_url text,
  ADD COLUMN IF NOT EXISTS whitelabel_from_email text;