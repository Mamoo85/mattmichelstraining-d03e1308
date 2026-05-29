-- Drop the overly permissive authenticated_all policy
DROP POLICY IF EXISTS "authenticated_all" ON public.prospect_pipeline;

-- Add admin-only SELECT policy
CREATE POLICY "admin_select" ON public.prospect_pipeline
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Add admin-only INSERT policy
CREATE POLICY "admin_insert" ON public.prospect_pipeline
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Add admin-only UPDATE policy
CREATE POLICY "admin_update" ON public.prospect_pipeline
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Add admin-only DELETE policy
CREATE POLICY "admin_delete" ON public.prospect_pipeline
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));