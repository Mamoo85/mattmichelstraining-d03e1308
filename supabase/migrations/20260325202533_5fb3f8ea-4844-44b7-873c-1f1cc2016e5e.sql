
-- 1. Create a secure view for client-side profile access (excludes stripe_customer_id)
CREATE OR REPLACE VIEW public.profiles_safe AS
SELECT
  id, user_id, full_name, email, athlete_name, is_pro,
  created_at, updated_at, subscription_tier, is_in_person,
  trial_started_at, trial_path, account_role,
  daily_calorie_goal, daily_protein_goal, daily_carbs_goal, daily_fat_goal,
  auto_regulate, is_vip, free_program_redeemed, referral_count,
  random_alias, invite_card_dismissed, is_public_profile
FROM public.profiles;

-- 2. Grant access
GRANT SELECT ON public.profiles_safe TO authenticated;
GRANT SELECT ON public.profiles_safe TO anon;
