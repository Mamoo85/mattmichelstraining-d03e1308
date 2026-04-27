CREATE TABLE IF NOT EXISTS public.health_check_pings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  auth_ok BOOLEAN NOT NULL DEFAULT false,
  db_read_ok BOOLEAN NOT NULL DEFAULT false,
  db_write_ok BOOLEAN NOT NULL DEFAULT false,
  latency_ms INTEGER,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.health_check_pings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role bypass on health_check_pings" ON public.health_check_pings;
CREATE POLICY "service_role bypass on health_check_pings"
  ON public.health_check_pings
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "admins can read health_check_pings" ON public.health_check_pings;
CREATE POLICY "admins can read health_check_pings"
  ON public.health_check_pings
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_health_check_pings_created_at
  ON public.health_check_pings (created_at DESC);
