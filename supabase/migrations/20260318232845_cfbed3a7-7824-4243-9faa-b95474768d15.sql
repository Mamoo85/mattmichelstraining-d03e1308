
CREATE TABLE public.user_content_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  program_id UUID REFERENCES public.training_programs(id) ON DELETE CASCADE,
  workout_id UUID REFERENCES public.daily_workouts(id) ON DELETE CASCADE,
  access_type TEXT NOT NULL DEFAULT 'gifted',
  granted_by UUID,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT,
  UNIQUE (user_id, program_id),
  UNIQUE (user_id, workout_id)
);

ALTER TABLE public.user_content_access ENABLE ROW LEVEL SECURITY;

-- Users can read their own access rows
CREATE POLICY "Users can view own content access"
  ON public.user_content_access FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Admins can manage all rows
CREATE POLICY "Admins can manage content access"
  ON public.user_content_access FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
