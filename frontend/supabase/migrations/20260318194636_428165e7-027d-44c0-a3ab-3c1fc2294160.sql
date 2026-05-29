
-- Daily workouts table for Basic tier standalone workouts
CREATE TABLE public.daily_workouts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  exercises JSONB NOT NULL DEFAULT '[]'::jsonb,
  target_audience TEXT NOT NULL DEFAULT 'all',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS: daily workouts readable by any authenticated user
ALTER TABLE public.daily_workouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read daily workouts"
  ON public.daily_workouts FOR SELECT
  TO authenticated
  USING (true);
CREATE POLICY "Admins can manage daily workouts"
  ON public.daily_workouts FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Gifted sessions table for Custom/Team tier gift-a-session feature
CREATE TABLE public.gifted_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  giver_user_id UUID NOT NULL,
  receiver_email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  claimed_at TIMESTAMP WITH TIME ZONE,
  claimed_by UUID
);

ALTER TABLE public.gifted_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their gifted sessions"
  ON public.gifted_sessions FOR SELECT
  TO authenticated
  USING (giver_user_id = auth.uid() OR claimed_by = auth.uid());
CREATE POLICY "Custom/Team users can insert gifted sessions"
  ON public.gifted_sessions FOR INSERT
  TO authenticated
  WITH CHECK (giver_user_id = auth.uid());
CREATE POLICY "Users can claim gifted sessions"
  ON public.gifted_sessions FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (claimed_by = auth.uid());

-- Add periodization columns to training_programs for 8-week blocks
ALTER TABLE public.training_programs
  ADD COLUMN IF NOT EXISTS total_weeks INTEGER NOT NULL DEFAULT 8,
  ADD COLUMN IF NOT EXISTS block_type TEXT NOT NULL DEFAULT 'linear',
  ADD COLUMN IF NOT EXISTS periodization_config JSONB DEFAULT '{}'::jsonb;
