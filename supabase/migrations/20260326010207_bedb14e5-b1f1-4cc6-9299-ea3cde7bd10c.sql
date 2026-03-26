
-- Drop the overly permissive policy that exposes all columns to all authenticated users
DROP POLICY IF EXISTS "Authenticated users can read display names" ON public.profiles;

-- Ensure owner can read their own full profile
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users can read own profile'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can read own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = user_id)';
  END IF;
END $$;

-- Ensure admin can read all profiles
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Admins can read all profiles'
  ) THEN
    EXECUTE 'CREATE POLICY "Admins can read all profiles" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), ''admin''::app_role))';
  END IF;
END $$;

-- Recreate profiles_public as security_invoker=off (intentional security definer)
-- This is safe because it ONLY exposes non-sensitive display columns
DROP VIEW IF EXISTS public.profiles_public;
CREATE VIEW public.profiles_public
WITH (security_invoker = off) AS
SELECT user_id, athlete_name, full_name, random_alias, is_public_profile
FROM public.profiles;

-- Restrict access to authenticated users only
REVOKE ALL ON public.profiles_public FROM anon;
REVOKE ALL ON public.profiles_public FROM public;
GRANT SELECT ON public.profiles_public TO authenticated;
