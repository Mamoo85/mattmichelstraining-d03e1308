
-- 1. Recreate profiles_safe with security_invoker so base table RLS applies
DROP VIEW IF EXISTS public.profiles_safe;

CREATE VIEW public.profiles_safe
WITH (security_invoker = on) AS
SELECT
  id,
  user_id,
  full_name,
  email,
  athlete_name,
  is_pro,
  created_at,
  updated_at,
  subscription_tier,
  is_in_person,
  trial_started_at,
  trial_path,
  account_role,
  daily_calorie_goal,
  daily_protein_goal,
  daily_carbs_goal,
  daily_fat_goal,
  auto_regulate,
  is_vip,
  free_program_redeemed,
  referral_count,
  random_alias,
  invite_card_dismissed,
  is_public_profile
FROM profiles;

-- 2. Create a minimal public names view for leaderboards/community feeds
-- This only exposes display name fields, no email/subscription/PII
CREATE VIEW public.profiles_public
WITH (security_invoker = off) AS
SELECT
  user_id,
  athlete_name,
  full_name,
  random_alias,
  is_public_profile
FROM profiles;

-- 3. Enable RLS on the base profiles table (should already be enabled, but ensure)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 4. Add a SELECT policy for profiles_public access
-- Since security_invoker is off, we need a separate policy approach.
-- The view bypasses RLS, but we limit it to only safe columns above.
-- For extra safety, grant SELECT on profiles_public only to authenticated
GRANT SELECT ON public.profiles_public TO authenticated;
REVOKE SELECT ON public.profiles_public FROM anon;
