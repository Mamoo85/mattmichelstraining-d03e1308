
-- Drop the security-definer profiles_public view
DROP VIEW IF EXISTS public.profiles_public;

-- Recreate with security_invoker = on (security invoker, not definer)
CREATE VIEW public.profiles_public
WITH (security_invoker = on) AS
SELECT
  user_id,
  athlete_name,
  full_name,
  random_alias,
  is_public_profile
FROM profiles;

-- Grant access to authenticated users
GRANT SELECT ON public.profiles_public TO authenticated;
REVOKE SELECT ON public.profiles_public FROM anon;

-- Add RLS policy so any authenticated user can SELECT these safe columns via the view
-- (the view inherits base table RLS, so we need a policy that allows reading other users' display names)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Authenticated users can read display names'
  ) THEN
    CREATE POLICY "Authenticated users can read display names"
    ON public.profiles
    FOR SELECT
    TO authenticated
    USING (true);
  END IF;
END $$;
