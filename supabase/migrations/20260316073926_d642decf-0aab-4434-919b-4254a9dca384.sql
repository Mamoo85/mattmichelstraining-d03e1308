CREATE POLICY "Admins can insert progress logs for anyone"
ON public.progress_logs FOR INSERT
TO public
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));