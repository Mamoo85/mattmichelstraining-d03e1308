CREATE TABLE IF NOT EXISTS public.trade_radar_area_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vertical text NOT NULL,
  scope text NOT NULL CHECK (scope IN ('zip','county','region','state')),
  scope_value text NOT NULL,
  alert_type text NOT NULL,
  alert_detail text,
  source text NOT NULL,
  source_url text,
  signal_date date NOT NULL DEFAULT CURRENT_DATE,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  raw_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (vertical, scope, scope_value, alert_type, signal_date)
);

CREATE INDEX IF NOT EXISTS idx_trade_radar_area_signals_vertical_exp
  ON public.trade_radar_area_signals (vertical, expires_at DESC);

CREATE INDEX IF NOT EXISTS idx_trade_radar_area_signals_scope
  ON public.trade_radar_area_signals (scope, scope_value);

ALTER TABLE public.trade_radar_area_signals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role bypass" ON public.trade_radar_area_signals;
CREATE POLICY "service_role bypass" ON public.trade_radar_area_signals
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "admins can read" ON public.trade_radar_area_signals;
CREATE POLICY "admins can read" ON public.trade_radar_area_signals
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));