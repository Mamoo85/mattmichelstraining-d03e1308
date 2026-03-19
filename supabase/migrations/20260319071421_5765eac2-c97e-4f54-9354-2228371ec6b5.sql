
-- Drop the overly permissive blanket read policy
DROP POLICY IF EXISTS "Authenticated can read privacy settings for visibility checks" ON public.user_privacy_settings;

-- Users can only read their own privacy settings
CREATE POLICY "Users can read own privacy settings"
  ON public.user_privacy_settings
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Create a SECURITY DEFINER function for checking another user's visibility flags
CREATE OR REPLACE FUNCTION public.check_user_visibility(_target_user_id uuid, _field text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE _field
    WHEN 'show_points' THEN COALESCE((SELECT show_points FROM user_privacy_settings WHERE user_id = _target_user_id), true)
    WHEN 'show_level' THEN COALESCE((SELECT show_level FROM user_privacy_settings WHERE user_id = _target_user_id), true)
    WHEN 'show_lifts' THEN COALESCE((SELECT show_lifts FROM user_privacy_settings WHERE user_id = _target_user_id), true)
    WHEN 'show_challenges' THEN COALESCE((SELECT show_challenges FROM user_privacy_settings WHERE user_id = _target_user_id), true)
    WHEN 'show_nutrition' THEN COALESCE((SELECT show_nutrition FROM user_privacy_settings WHERE user_id = _target_user_id), true)
    WHEN 'show_streaks' THEN COALESCE((SELECT show_streaks FROM user_privacy_settings WHERE user_id = _target_user_id), true)
    WHEN 'show_programs' THEN COALESCE((SELECT show_programs FROM user_privacy_settings WHERE user_id = _target_user_id), true)
    ELSE true
  END
$$;
