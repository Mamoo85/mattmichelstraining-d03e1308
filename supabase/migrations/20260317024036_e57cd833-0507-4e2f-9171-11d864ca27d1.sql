
-- Allow users to insert their own active programs (for verification flow)
CREATE POLICY "Users can insert own active programs" ON public.user_active_programs
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
