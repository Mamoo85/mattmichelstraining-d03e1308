CREATE POLICY "Receivers can view pending sessions by email"
ON public.gifted_sessions
FOR SELECT
TO authenticated
USING (
  receiver_email = (SELECT email FROM auth.users WHERE id = auth.uid())
);