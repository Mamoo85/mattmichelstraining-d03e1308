
-- Allow users to update their own progress logs
CREATE POLICY "Users can update their own progress" ON public.progress_logs
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Allow users to delete their own progress logs
CREATE POLICY "Users can delete their own progress" ON public.progress_logs
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Allow admins to update any progress logs
CREATE POLICY "Admins can update all progress logs" ON public.progress_logs
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'));

-- Allow admins to delete any progress logs
CREATE POLICY "Admins can delete all progress logs" ON public.progress_logs
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));
