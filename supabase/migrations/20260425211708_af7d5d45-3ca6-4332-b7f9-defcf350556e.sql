CREATE TABLE IF NOT EXISTS public.alert_throttle (
  alert_key       TEXT PRIMARY KEY,
  first_seen_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_sent_at    TIMESTAMPTZ,
  hit_count       INTEGER NOT NULL DEFAULT 1,
  suppressed_count INTEGER NOT NULL DEFAULT 0,
  window_minutes  INTEGER NOT NULL DEFAULT 30
);
CREATE INDEX IF NOT EXISTS idx_alert_throttle_last_seen ON public.alert_throttle (last_seen_at DESC);
ALTER TABLE public.alert_throttle ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role bypass" ON public.alert_throttle;
CREATE POLICY "service_role bypass" ON public.alert_throttle FOR ALL TO service_role USING (true) WITH CHECK (true);