
-- cold_sender_ticks: visibility row per cold-sender-master invocation
CREATE TABLE IF NOT EXISTS public.cold_sender_ticks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ran_at timestamptz NOT NULL DEFAULT now(),
  daily_cap integer NOT NULL,
  sent_today integer NOT NULL DEFAULT 0,
  queued_today integer NOT NULL DEFAULT 0,
  tick_quota integer NOT NULL DEFAULT 0,
  enqueued integer NOT NULL DEFAULT 0,
  skipped integer NOT NULL DEFAULT 0,
  notes text,
  debug jsonb
);

CREATE INDEX IF NOT EXISTS idx_cold_sender_ticks_ran_at ON public.cold_sender_ticks (ran_at DESC);

ALTER TABLE public.cold_sender_ticks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cold_sender_ticks_service_all ON public.cold_sender_ticks;
CREATE POLICY cold_sender_ticks_service_all ON public.cold_sender_ticks
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS cold_sender_ticks_admin_read ON public.cold_sender_ticks;
CREATE POLICY cold_sender_ticks_admin_read ON public.cold_sender_ticks
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
