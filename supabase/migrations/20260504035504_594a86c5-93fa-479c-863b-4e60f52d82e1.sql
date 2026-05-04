ALTER TABLE public.trade_radar_leads
  ADD COLUMN IF NOT EXISTS street_view_url TEXT;

NOTIFY pgrst, 'reload schema';