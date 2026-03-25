
CREATE POLICY "Admins can view all nutrition logs"
ON public.nutrition_logs
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));
