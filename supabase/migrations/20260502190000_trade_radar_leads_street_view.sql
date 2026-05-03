-- Add street_view_url to trade_radar_leads (mirrors mortgage_radar_leads pattern)
ALTER TABLE public.trade_radar_leads
  ADD COLUMN IF NOT EXISTS street_view_url TEXT;
