
-- 1. Add deduplication: unique constraint on (user_id, action, reference_id) where reference_id is not null
CREATE UNIQUE INDEX IF NOT EXISTS idx_point_transactions_dedup 
ON public.point_transactions (user_id, action, reference_id) 
WHERE reference_id IS NOT NULL;

-- 2. Create trigger function for progress_logs (workout_log: 25 pts)
CREATE OR REPLACE FUNCTION public.award_points_on_progress_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.point_transactions (user_id, action, points, description, reference_id)
  VALUES (NEW.user_id, 'workout_log', 25, 'Logged ' || NEW.exercise_name, NEW.id::text)
  ON CONFLICT DO NOTHING;

  -- Update total (upsert user_points)
  INSERT INTO public.user_points (user_id, total_points)
  VALUES (NEW.user_id, 25)
  ON CONFLICT (user_id) DO UPDATE SET total_points = user_points.total_points + 25;

  -- Recalculate level
  UPDATE public.user_points SET level = CASE
    WHEN total_points >= 10000 THEN 'legend'
    WHEN total_points >= 4000 THEN 'beast'
    WHEN total_points >= 1500 THEN 'competitor'
    WHEN total_points >= 500 THEN 'grinder'
    ELSE 'rookie'
  END WHERE user_id = NEW.user_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_award_points_progress_log
AFTER INSERT ON public.progress_logs
FOR EACH ROW EXECUTE FUNCTION public.award_points_on_progress_log();

-- 3. Create trigger function for studio_checkins (studio_checkin: 50 pts)
CREATE OR REPLACE FUNCTION public.award_points_on_studio_checkin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.point_transactions (user_id, action, points, description, reference_id)
  VALUES (NEW.user_id, 'studio_checkin', 50, 'Studio check-in', NEW.id::text)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.user_points (user_id, total_points)
  VALUES (NEW.user_id, 50)
  ON CONFLICT (user_id) DO UPDATE SET total_points = user_points.total_points + 50;

  UPDATE public.user_points SET level = CASE
    WHEN total_points >= 10000 THEN 'legend'
    WHEN total_points >= 4000 THEN 'beast'
    WHEN total_points >= 1500 THEN 'competitor'
    WHEN total_points >= 500 THEN 'grinder'
    ELSE 'rookie'
  END WHERE user_id = NEW.user_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_award_points_studio_checkin
AFTER INSERT ON public.studio_checkins
FOR EACH ROW EXECUTE FUNCTION public.award_points_on_studio_checkin();

-- 4. Create trigger function for community_workouts (community_workout: 30 pts, only if public)
CREATE OR REPLACE FUNCTION public.award_points_on_community_workout()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.is_public = true THEN
    INSERT INTO public.point_transactions (user_id, action, points, description, reference_id)
    VALUES (NEW.user_id, 'community_workout', 30, 'Shared a community workout', NEW.id::text)
    ON CONFLICT DO NOTHING;

    INSERT INTO public.user_points (user_id, total_points)
    VALUES (NEW.user_id, 30)
    ON CONFLICT (user_id) DO UPDATE SET total_points = user_points.total_points + 30;

    UPDATE public.user_points SET level = CASE
      WHEN total_points >= 10000 THEN 'legend'
      WHEN total_points >= 4000 THEN 'beast'
      WHEN total_points >= 1500 THEN 'competitor'
      WHEN total_points >= 500 THEN 'grinder'
      ELSE 'rookie'
    END WHERE user_id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_award_points_community_workout
AFTER INSERT ON public.community_workouts
FOR EACH ROW EXECUTE FUNCTION public.award_points_on_community_workout();

-- 5. Create trigger function for challenge_entries (challenge_entry: 10 pts)
CREATE OR REPLACE FUNCTION public.award_points_on_challenge_entry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.point_transactions (user_id, action, points, description, reference_id)
  VALUES (NEW.user_id, 'challenge_entry', 10, 'Monthly challenge entry', NEW.id::text)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.user_points (user_id, total_points)
  VALUES (NEW.user_id, 10)
  ON CONFLICT (user_id) DO UPDATE SET total_points = user_points.total_points + 10;

  UPDATE public.user_points SET level = CASE
    WHEN total_points >= 10000 THEN 'legend'
    WHEN total_points >= 4000 THEN 'beast'
    WHEN total_points >= 1500 THEN 'competitor'
    WHEN total_points >= 500 THEN 'grinder'
    ELSE 'rookie'
  END WHERE user_id = NEW.user_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_award_points_challenge_entry
AFTER INSERT ON public.challenge_entries
FOR EACH ROW EXECUTE FUNCTION public.award_points_on_challenge_entry();

-- 6. Revoke EXECUTE on award_points from authenticated users (only service_role and admins via RPC remain)
-- We keep the function but restrict: non-admin authenticated users can no longer call it
-- Update the function to only allow admin or service_role callers
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
  is_admin BOOLEAN;
  caller_role TEXT;
BEGIN
  -- Get the current role (anon, authenticated, service_role)
  caller_role := current_setting('request.jwt.claim.role', true);
  is_admin := has_role(auth.uid(), 'admin');

  -- Only allow service_role or admin callers
  IF caller_role != 'service_role' AND NOT is_admin THEN
    RAISE EXCEPTION 'Forbidden: only admins and server functions can award points';
  END IF;

  -- Validate action is in allowlist
  IF NOT (_action = ANY(valid_actions)) THEN
    RAISE EXCEPTION 'Invalid action: %', _action;
  END IF;

  -- Prevent negative points from non-admins
  IF _points < 0 AND NOT is_admin THEN
    RAISE EXCEPTION 'Cannot award negative points';
  END IF;

  -- Ensure user_points row exists
  INSERT INTO public.user_points (user_id, total_points)
  VALUES (_user_id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  -- Insert transaction (with dedup if reference_id provided)
  INSERT INTO public.point_transactions (user_id, action, points, description, reference_id)
  VALUES (_user_id, _action, _points, _description, _reference_id)
  ON CONFLICT DO NOTHING;

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
