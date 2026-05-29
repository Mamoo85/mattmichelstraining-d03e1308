
DROP POLICY "Users can insert own activity logs" ON public.activity_logs;

CREATE POLICY "Users and admins can insert activity logs"
ON public.activity_logs
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role)
);
