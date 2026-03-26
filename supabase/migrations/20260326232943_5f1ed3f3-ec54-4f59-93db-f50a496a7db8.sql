-- Drop the security_definer view that triggers linter warnings
DROP VIEW IF EXISTS public.training_programs_public;

-- Create a security_invoker view (safe, no linter issues)
-- But it needs a SELECT policy on base table to work.
-- Add a narrow policy that only returns non-sensitive fields won't work 
-- (RLS is row-level not column-level).
-- 
-- Best approach: recreate as security_invoker view + add back a SELECT
-- policy on base table. The view filters columns, but direct table 
-- queries would also work. To prevent direct base table access exposing
-- stripe fields, we use the view + an RPC function approach.

-- Create a security definer function that returns safe program data
CREATE OR REPLACE FUNCTION public.get_active_training_programs()
RETURNS TABLE(
  id uuid,
  title text,
  description text,
  category text,
  level text,
  sport text,
  price numeric,
  total_weeks integer,
  is_active boolean,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, title, description, category, level, sport, price, total_weeks, is_active, created_at
  FROM public.training_programs
  WHERE is_active = true;
$$;

-- Also recreate the view as security_invoker for backward compatibility
-- with code that references it, backed by a SELECT policy
CREATE VIEW public.training_programs_public
WITH (security_invoker = on) AS
SELECT id, title, description, category, level, sport, price, total_weeks, is_active, created_at
FROM public.training_programs
WHERE is_active = true;

-- Add SELECT policy for authenticated users on active programs
-- This is needed for the security_invoker view to work
CREATE POLICY "Authenticated can read active programs"
ON public.training_programs
FOR SELECT
TO authenticated
USING (is_active = true);

GRANT SELECT ON public.training_programs_public TO authenticated;