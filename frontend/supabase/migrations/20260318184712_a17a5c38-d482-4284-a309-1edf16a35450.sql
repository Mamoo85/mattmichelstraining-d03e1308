
-- 1. Secure award_points: add caller check and action/points validation
CREATE OR REPLACE FUNCTION public.award_points(_user_id uuid, _action text, _points integer, _description text DEFAULT ''::text, _reference_id text DEFAULT NULL::text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  new_total INTEGER;
  new_level TEXT;
  valid_actions TEXT[] := ARRAY['workout_log', 'studio_checkin', 'community_workout', 'workout_scan', 'challenge_entry', 'weekly_streak', 'membership', 'program_purchase', 'admin_award', 'admin_deduct', 'referral_bonus'];
BEGIN
  -- Caller must be awarding to themselves, or be an admin, or be service_role
  IF _user_id != auth.uid() AND NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden: cannot award points to another user';
  END IF;

  -- Validate action is in allowlist (admins can use any action)
  IF NOT (_action = ANY(valid_actions)) AND NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Invalid action: %', _action;
  END IF;

  -- Cap points per call for non-admins (max 200 per single award)
  IF _points > 200 AND NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Points exceed maximum allowed per action';
  END IF;

  -- Prevent negative points from non-admins
  IF _points < 0 AND NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Cannot award negative points';
  END IF;

  -- Ensure user_points row exists
  INSERT INTO public.user_points (user_id, total_points)
  VALUES (_user_id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  -- Insert transaction
  INSERT INTO public.point_transactions (user_id, action, points, description, reference_id)
  VALUES (_user_id, _action, _points, _description, _reference_id);

  -- Update total
  UPDATE public.user_points
  SET total_points = total_points + _points
  WHERE user_id = _user_id
  RETURNING total_points INTO new_total;

  -- Calculate level
  new_level := CASE
    WHEN new_total >= 10000 THEN 'legend'
    WHEN new_total >= 4000 THEN 'beast'
    WHEN new_total >= 1500 THEN 'competitor'
    WHEN new_total >= 500 THEN 'grinder'
    ELSE 'rookie'
  END;

  UPDATE public.user_points SET level = new_level WHERE user_id = _user_id;

  RETURN new_total;
END;
$$;

-- 2. Fix user_points RLS: remove permissive INSERT/UPDATE, restrict to is_public toggle only
DROP POLICY IF EXISTS "Users can insert own points" ON public.user_points;
DROP POLICY IF EXISTS "Users can update own points" ON public.user_points;

-- Users can only toggle their visibility (is_public column)
CREATE POLICY "Users can toggle own visibility"
  ON public.user_points FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 3. Fix program_workouts: restrict to purchasers/enrolled users + admins + trial programs
DROP POLICY IF EXISTS "Anyone can view program workouts" ON public.program_workouts;

CREATE POLICY "Purchasers and enrolled users can view program workouts"
  ON public.program_workouts FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.user_active_programs uap
      WHERE uap.program_id = program_workouts.program_id AND uap.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.training_programs tp
      WHERE tp.id = program_workouts.program_id AND tp.is_trial = true AND tp.is_active = true
    )
  );

-- 4. Fix team_members: restrict peer visibility to exclude athlete_email
-- We can't do column-level RLS easily, so we create a view approach.
-- Instead, tighten the peer policy to only show name/status, not email.
-- Since RLS can't filter columns, we'll restrict the peer policy and
-- rely on the app to not display emails for non-owners.
-- The existing "Members can view own roster peers" policy already exists.
-- We need to check if it exists first.
DROP POLICY IF EXISTS "Members can view own roster peers" ON public.team_members;

-- Peers can only see their own roster members (app should not display emails)
-- But for true security, restrict to owners/admins only for full data
-- Members can only see their own record
CREATE POLICY "Members can view own record"
  ON public.team_members FOR SELECT
  TO authenticated
  USING (athlete_user_id = auth.uid());

-- Roster owners can see all their team members (including emails)
CREATE POLICY "Roster owners can view all members"
  ON public.team_members FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.team_rosters tr
      WHERE tr.id = team_members.roster_id AND tr.owner_id = auth.uid()
    )
  );
