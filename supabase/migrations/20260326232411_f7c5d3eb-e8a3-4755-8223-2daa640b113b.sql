-- Remove the overly broad SELECT policy that exposes stripe IDs to all authenticated users
DROP POLICY IF EXISTS "Authenticated users can view active programs" ON public.training_programs;

-- Admins can read all training programs (base table with stripe fields)
CREATE POLICY "Admins can read all training programs"
ON public.training_programs
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));