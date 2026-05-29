
CREATE TABLE public.exercise_library (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  client_type TEXT[] NOT NULL DEFAULT '{}',
  focus_area TEXT[] NOT NULL DEFAULT '{}',
  equipment_needed TEXT NOT NULL DEFAULT '',
  the_why TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.exercise_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read exercises" ON public.exercise_library
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Admins can insert exercises" ON public.exercise_library
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update exercises" ON public.exercise_library
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete exercises" ON public.exercise_library
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
