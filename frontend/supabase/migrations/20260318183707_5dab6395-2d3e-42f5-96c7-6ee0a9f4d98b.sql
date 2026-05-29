
-- Remove the overly permissive authenticated SELECT policy
DROP POLICY IF EXISTS "Authenticated can view slots" ON public.schedule_slots;

-- Regular authenticated users can only see available unbooked slots (same as anon)
CREATE POLICY "Authenticated can view available slots"
  ON public.schedule_slots FOR SELECT
  TO authenticated
  USING (
    (is_available = true AND booked_by IS NULL)
    OR has_role(auth.uid(), 'admin'::app_role)
    OR auth.uid() = booked_by
  );
