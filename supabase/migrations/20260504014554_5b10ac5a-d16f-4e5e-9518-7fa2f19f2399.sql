-- Cold email deliverability-aware ramp state
CREATE TABLE IF NOT EXISTS public.cold_email_ramp_state (
  id INTEGER PRIMARY KEY DEFAULT 1,
  ramp_start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  base_cap INTEGER NOT NULL DEFAULT 50,
  step_per_day INTEGER NOT NULL DEFAULT 25,
  ceiling INTEGER NOT NULL DEFAULT 500,
  bounce_threshold_pct NUMERIC NOT NULL DEFAULT 4.0,
  complaint_threshold_pct NUMERIC NOT NULL DEFAULT 0.3,
  paused BOOLEAN NOT NULL DEFAULT false,
  pause_reason TEXT,
  current_cap INTEGER NOT NULL DEFAULT 50,
  last_evaluated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT cold_email_ramp_state_singleton CHECK (id = 1)
);

INSERT INTO public.cold_email_ramp_state (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.cold_email_ramp_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_ramp_state" ON public.cold_email_ramp_state
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "admins_read_ramp_state" ON public.cold_email_ramp_state
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins_update_ramp_state" ON public.cold_email_ramp_state
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

-- Daily ramp evaluation history
CREATE TABLE IF NOT EXISTS public.cold_email_ramp_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  day_index INTEGER NOT NULL,
  sent_24h INTEGER NOT NULL DEFAULT 0,
  bounce_pct NUMERIC NOT NULL DEFAULT 0,
  complaint_pct NUMERIC NOT NULL DEFAULT 0,
  prev_cap INTEGER NOT NULL,
  new_cap INTEGER NOT NULL,
  action TEXT NOT NULL,
  notes TEXT
);

ALTER TABLE public.cold_email_ramp_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_ramp_history" ON public.cold_email_ramp_history
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "admins_read_ramp_history" ON public.cold_email_ramp_history
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));