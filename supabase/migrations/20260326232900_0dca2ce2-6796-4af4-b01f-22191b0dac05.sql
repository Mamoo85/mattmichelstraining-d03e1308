-- Remove the broad SELECT policy that re-exposes stripe fields
DROP POLICY IF EXISTS "Authenticated users can read active programs via view" ON public.training_programs;

-- Recreate view as security_definer so it bypasses base table RLS
-- (the view itself only exposes safe columns, no stripe fields)
DROP VIEW IF EXISTS public.training_programs_public;
CREATE VIEW public.training_programs_public
WITH (security_invoker = false) AS
SELECT id, title, description, category, level, sport, price, total_weeks, is_active, created_at
FROM public.training_programs
WHERE is_active = true;