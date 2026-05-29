
DROP POLICY "Service role can insert retention_alerts" ON public.retention_alerts;

CREATE POLICY "Admins can insert retention_alerts"
  ON public.retention_alerts FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
