-- Tighten capture_submissions authenticated INSERT policy to enforce tenant ownership
DROP POLICY IF EXISTS "Capture submissions: authenticated can insert" ON public.capture_submissions;

CREATE POLICY "capture_auth_own_tenant_only"
  ON public.capture_submissions
  FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = public.get_tenant_id(auth.uid()));