
-- Allow admins to delete training programs
CREATE POLICY "Admins can delete training programs" ON public.training_programs
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete program workouts
CREATE POLICY "Admins can delete program workouts" ON public.program_workouts
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
