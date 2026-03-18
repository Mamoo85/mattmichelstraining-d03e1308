
-- Add session_type to session_bookings
ALTER TABLE public.session_bookings 
ADD COLUMN IF NOT EXISTS session_type text NOT NULL DEFAULT 'in_person';

-- Add credit_id to track if booking was paid via credit
ALTER TABLE public.session_bookings 
ADD COLUMN IF NOT EXISTS credit_id uuid;

-- Create session_credits table for Elite monthly included sessions
CREATE TABLE public.session_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  credit_type text NOT NULL DEFAULT '30_min',
  month integer NOT NULL,
  year integer NOT NULL,
  is_used boolean NOT NULL DEFAULT false,
  used_at timestamp with time zone,
  booking_id uuid REFERENCES public.session_bookings(id),
  granted_at timestamp with time zone NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'subscription',
  UNIQUE (user_id, credit_type, month, year)
);

ALTER TABLE public.session_credits ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "Admins can manage all credits"
ON public.session_credits FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Users can view own credits
CREATE POLICY "Users can view own credits"
ON public.session_credits FOR SELECT TO authenticated
USING (auth.uid() = user_id);

-- Service role full access
CREATE POLICY "Service role manages credits"
ON public.session_credits FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- Add Google Calendar event ID to session_bookings for sync
ALTER TABLE public.session_bookings 
ADD COLUMN IF NOT EXISTS google_calendar_event_id text;
