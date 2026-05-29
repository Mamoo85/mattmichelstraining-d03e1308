
-- Drop profiles_safe view entirely — no frontend code references it
-- The profiles table itself has proper owner+admin RLS policies
DROP VIEW IF EXISTS public.profiles_safe;
