
-- Add deny-all RLS policies for free_generation_log
-- This table is only accessed by edge functions using service_role key
-- which bypasses RLS. No authenticated user should read or write directly.

CREATE POLICY "Deny all direct access"
  ON public.free_generation_log
  FOR ALL
  TO authenticated, anon
  USING (false)
  WITH CHECK (false);
