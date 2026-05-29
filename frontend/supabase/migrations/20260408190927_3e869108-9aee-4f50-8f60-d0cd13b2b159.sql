-- Add admin SELECT policy for prospect_businesses
CREATE POLICY "admin_select_prospect_businesses"
ON public.prospect_businesses
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));