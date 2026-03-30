-- Fix: Drop the public-role SELECT policies and recreate targeting service_role only
DROP POLICY IF EXISTS "Service role can read send log" ON public.email_send_log;
DROP POLICY IF EXISTS "Deny authenticated read on email_send_log" ON public.email_send_log;
DROP POLICY IF EXISTS "Service role can insert send log" ON public.email_send_log;
DROP POLICY IF EXISTS "Service role can update send log" ON public.email_send_log;

-- Recreate policies targeting service_role explicitly
CREATE POLICY "Service role can read send log" ON public.email_send_log FOR SELECT TO service_role USING (true);
CREATE POLICY "Service role can insert send log" ON public.email_send_log FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "Service role can update send log" ON public.email_send_log FOR UPDATE TO service_role USING (true) WITH CHECK (true);

-- Also allow admins to read via authenticated role
CREATE POLICY "Admins can read send log" ON public.email_send_log FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));