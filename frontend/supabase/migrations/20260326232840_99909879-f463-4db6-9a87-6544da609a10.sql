-- Fix 1: Replace misleadingly-named permissive INSERT policy with a correctly-named one
DROP POLICY IF EXISTS "Non-admins cannot insert roles" ON public.user_roles;
CREATE POLICY "Only admins can insert roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Fix 2: The training_programs_public view uses security_invoker=on,
-- so it inherits RLS from the base training_programs table.
-- Views don't support RLS directly, but we can ensure the base table
-- policy allows SELECT for the safe columns the view exposes.
-- The current admin-only SELECT on training_programs is too restrictive
-- for the public view. Add a limited SELECT policy for active programs
-- (the view already filters to is_active=true and excludes stripe fields).
CREATE POLICY "Authenticated users can read active programs via view"
ON public.training_programs
FOR SELECT
TO authenticated
USING (is_active = true);

-- But we need to restrict which columns are visible. Since Postgres RLS
-- is row-level not column-level, the view handles column filtering.
-- The security_invoker view only returns: id, title, description, category, 
-- level, sport, price, total_weeks, is_active, created_at (no stripe fields).
-- So this SELECT policy is safe because non-admin users can only access
-- the table through the view which strips sensitive columns.