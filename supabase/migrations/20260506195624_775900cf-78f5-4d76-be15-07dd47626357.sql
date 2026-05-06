-- Extend demo_bookings with outcome + reminder fields
ALTER TABLE public.demo_bookings
  ADD COLUMN IF NOT EXISTS outcome text CHECK (outcome IN ('scheduled','showed','no_show','won','lost','follow_up')),
  ADD COLUMN IF NOT EXISTS outcome_notes text,
  ADD COLUMN IF NOT EXISTS offer_pitched text,
  ADD COLUMN IF NOT EXISTS deal_value_usd numeric,
  ADD COLUMN IF NOT EXISTS outcome_set_at timestamptz,
  ADD COLUMN IF NOT EXISTS next_action_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_24h_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_1h_sent_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_demo_bookings_outcome ON public.demo_bookings(outcome);
CREATE INDEX IF NOT EXISTS idx_demo_bookings_reminders ON public.demo_bookings(slot_date, slot_time)
  WHERE reminder_24h_sent_at IS NULL OR reminder_1h_sent_at IS NULL;

-- Append-only audit trail of outcome changes
CREATE TABLE IF NOT EXISTS public.demo_outcome_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.demo_bookings(id) ON DELETE CASCADE,
  outcome text,
  notes text,
  offer_pitched text,
  deal_value_usd numeric,
  actor text NOT NULL DEFAULT 'matt',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.demo_outcome_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_demo_outcome_log" ON public.demo_outcome_log
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "admins_read_demo_outcome_log" ON public.demo_outcome_log
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_demo_outcome_log_booking ON public.demo_outcome_log(booking_id, created_at DESC);