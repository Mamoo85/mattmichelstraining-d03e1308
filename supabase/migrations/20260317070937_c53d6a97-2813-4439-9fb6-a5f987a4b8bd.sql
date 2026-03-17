
-- Create schedule_slots table
CREATE TABLE public.schedule_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_date date NOT NULL,
  start_time time NOT NULL,
  is_available boolean NOT NULL DEFAULT false,
  booked_by uuid,
  booking_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(slot_date, start_time)
);

-- Create session_bookings table
CREATE TABLE public.session_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  slot_date date NOT NULL,
  start_time time NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 30,
  amount_cents integer NOT NULL,
  stripe_session_id text,
  stripe_payment_intent_id text,
  status text NOT NULL DEFAULT 'confirmed',
  user_email text,
  user_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  cancelled_at timestamptz
);

-- Enable RLS
ALTER TABLE public.schedule_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_bookings ENABLE ROW LEVEL SECURITY;

-- Schedule slots policies
CREATE POLICY "Anyone can view slots" ON public.schedule_slots FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins can manage slots" ON public.schedule_slots FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Service role manages slots" ON public.schedule_slots FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Session bookings policies
CREATE POLICY "Users view own bookings" ON public.session_bookings FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins manage bookings" ON public.session_bookings FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Service role manages bookings" ON public.session_bookings FOR ALL TO service_role USING (true) WITH CHECK (true);
