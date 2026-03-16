
-- Rename the old workout_logs table to avoid conflicts
ALTER TABLE public.workout_logs RENAME TO workout_logs_legacy;

-- New normalized workout logging system
CREATE TABLE public.workout_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  session_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.logged_exercises (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  log_id UUID NOT NULL REFERENCES public.workout_logs(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES public.exercise_library(id) ON DELETE CASCADE,
  sets_reps_weight JSONB NOT NULL DEFAULT '[]'::jsonb,
  client_notes TEXT,
  video_url TEXT,
  flag_for_coach BOOLEAN NOT NULL DEFAULT false,
  coach_reply TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS for workout_logs
ALTER TABLE public.workout_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own logs" ON public.workout_logs
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own logs" ON public.workout_logs
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own logs" ON public.workout_logs
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own logs" ON public.workout_logs
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all logs" ON public.workout_logs
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update all logs" ON public.workout_logs
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- RLS for logged_exercises
ALTER TABLE public.logged_exercises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own exercises" ON public.logged_exercises
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.workout_logs WHERE id = log_id AND user_id = auth.uid())
  );

CREATE POLICY "Users can insert own exercises" ON public.logged_exercises
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.workout_logs WHERE id = log_id AND user_id = auth.uid())
  );

CREATE POLICY "Users can update own exercises" ON public.logged_exercises
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.workout_logs WHERE id = log_id AND user_id = auth.uid())
  );

CREATE POLICY "Users can delete own exercises" ON public.logged_exercises
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.workout_logs WHERE id = log_id AND user_id = auth.uid())
  );

CREATE POLICY "Admins can view all exercises" ON public.logged_exercises
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update all exercises" ON public.logged_exercises
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
