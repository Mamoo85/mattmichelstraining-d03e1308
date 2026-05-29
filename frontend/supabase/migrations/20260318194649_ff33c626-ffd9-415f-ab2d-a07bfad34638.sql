
-- Fix permissive RLS: restrict UPDATE on gifted_sessions to only unclaimed sessions
DROP POLICY IF EXISTS "Users can claim gifted sessions" ON public.gifted_sessions;
CREATE POLICY "Users can claim gifted sessions"
  ON public.gifted_sessions FOR UPDATE
  TO authenticated
  USING (status = 'pending' AND claimed_by IS NULL)
  WITH CHECK (claimed_by = auth.uid() AND status = 'claimed');
