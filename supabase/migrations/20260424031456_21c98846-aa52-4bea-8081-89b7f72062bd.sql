-- Add score history tracking to mortgage radar leads
ALTER TABLE public.mortgage_radar_leads
  ADD COLUMN IF NOT EXISTS score_history JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS last_score_alert_at TIMESTAMPTZ;

-- Buyer watches table (price-drop alerts + watched leads rail)
CREATE TABLE IF NOT EXISTS public.marketplace_buyer_watches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_email TEXT NOT NULL,
  lead_id UUID NOT NULL,
  product TEXT NOT NULL,
  last_price_cents INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (buyer_email, lead_id)
);

CREATE INDEX IF NOT EXISTS idx_marketplace_buyer_watches_email
  ON public.marketplace_buyer_watches (buyer_email);
CREATE INDEX IF NOT EXISTS idx_marketplace_buyer_watches_lead
  ON public.marketplace_buyer_watches (lead_id);

ALTER TABLE public.marketplace_buyer_watches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read marketplace_buyer_watches"
  ON public.marketplace_buyer_watches
  FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert marketplace_buyer_watches"
  ON public.marketplace_buyer_watches
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update marketplace_buyer_watches"
  ON public.marketplace_buyer_watches
  FOR UPDATE
  USING (true);

CREATE POLICY "Anyone can delete marketplace_buyer_watches"
  ON public.marketplace_buyer_watches
  FOR DELETE
  USING (true);

-- Buyer visits table (new since last visit badges + reengagement)
CREATE TABLE IF NOT EXISTS public.marketplace_buyer_visits (
  buyer_email TEXT PRIMARY KEY,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  visit_count INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.marketplace_buyer_visits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read marketplace_buyer_visits"
  ON public.marketplace_buyer_visits
  FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert marketplace_buyer_visits"
  ON public.marketplace_buyer_visits
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update marketplace_buyer_visits"
  ON public.marketplace_buyer_visits
  FOR UPDATE
  USING (true);

-- ZIP heat index function: count of mortgage_radar_leads in a ZIP over last 30d
CREATE OR REPLACE FUNCTION public.mp_zip_heat_index(p_zip TEXT)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::INTEGER
  FROM public.mortgage_radar_leads
  WHERE zip = p_zip
    AND created_at >= now() - INTERVAL '30 days';
$$;

-- Signal velocity function: signal count for a lead over last 30d
CREATE OR REPLACE FUNCTION public.mp_signal_velocity(p_lead_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(jsonb_array_length(score_history), 0)::INTEGER
  FROM public.mortgage_radar_leads
  WHERE id = p_lead_id;
$$;

-- Trigger to keep updated_at fresh on watches
CREATE OR REPLACE FUNCTION public.touch_marketplace_buyer_watches()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_marketplace_buyer_watches ON public.marketplace_buyer_watches;
CREATE TRIGGER trg_touch_marketplace_buyer_watches
  BEFORE UPDATE ON public.marketplace_buyer_watches
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_marketplace_buyer_watches();