
-- Table: training_programs
CREATE TABLE public.training_programs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'Athlete',
  age_range TEXT NOT NULL DEFAULT '',
  sex TEXT NOT NULL DEFAULT 'Any',
  sport TEXT,
  price NUMERIC NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table: program_workouts
CREATE TABLE public.program_workouts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  program_id UUID NOT NULL REFERENCES public.training_programs(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES public.exercise_library(id) ON DELETE CASCADE,
  week_number INTEGER NOT NULL DEFAULT 1,
  day_number INTEGER NOT NULL DEFAULT 1,
  prescribed_sets_reps TEXT NOT NULL DEFAULT '',
  coach_instructions TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table: user_active_programs
CREATE TABLE public.user_active_programs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  program_id UUID NOT NULL REFERENCES public.training_programs(id) ON DELETE CASCADE,
  start_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'active',
  stripe_session_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS on training_programs (public read, admin write)
ALTER TABLE public.training_programs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active programs" ON public.training_programs
  FOR SELECT TO anon, authenticated USING (is_active = true);

CREATE POLICY "Admins can manage training programs" ON public.training_programs
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- RLS on program_workouts (public read via active program, admin write)
ALTER TABLE public.program_workouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view program workouts" ON public.program_workouts
  FOR SELECT TO anon, authenticated USING (
    EXISTS (SELECT 1 FROM public.training_programs WHERE id = program_workouts.program_id AND is_active = true)
  );

CREATE POLICY "Admins can manage program workouts" ON public.program_workouts
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- RLS on user_active_programs (users see own, admin sees all)
ALTER TABLE public.user_active_programs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own active programs" ON public.user_active_programs
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all user programs" ON public.user_active_programs
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role can insert user programs" ON public.user_active_programs
  FOR INSERT TO service_role WITH CHECK (true);
