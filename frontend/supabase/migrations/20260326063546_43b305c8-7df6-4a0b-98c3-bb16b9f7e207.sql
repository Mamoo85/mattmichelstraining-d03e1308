
-- Create a public-safe view that excludes Stripe IDs
CREATE OR REPLACE VIEW public.training_programs_public AS
SELECT id, title, description, category, level, sport, price, total_weeks, is_active, created_at
FROM public.training_programs
WHERE is_active = true;

-- Grant access to the view for anon and authenticated
GRANT SELECT ON public.training_programs_public TO anon, authenticated;

-- Drop the old permissive public policy
DROP POLICY IF EXISTS "Anyone can view active programs" ON public.training_programs;

-- Authenticated users can view active programs (no Stripe IDs leak via direct table for non-admin)
CREATE POLICY "Authenticated users can view active programs"
ON public.training_programs
FOR SELECT
TO authenticated
USING (is_active = true);

-- Admins retain full access (already covered by existing admin policy, but ensure)
DROP POLICY IF EXISTS "Admins can manage programs" ON public.training_programs;
CREATE POLICY "Admins full access on training_programs"
ON public.training_programs
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));
