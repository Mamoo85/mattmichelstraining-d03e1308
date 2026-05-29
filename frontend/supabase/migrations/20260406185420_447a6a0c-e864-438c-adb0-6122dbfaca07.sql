-- Allow enrolled users to read their purchased training programs
CREATE POLICY "enrolled_users_read_programs"
  ON public.training_programs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_active_programs uap
      WHERE uap.program_id = training_programs.id
        AND uap.user_id = auth.uid()
    )
  );

-- Also allow reading active programs publicly (matches existing RPC behavior)
CREATE POLICY "public_read_active_programs"
  ON public.training_programs
  FOR SELECT
  TO authenticated
  USING (is_active = true);