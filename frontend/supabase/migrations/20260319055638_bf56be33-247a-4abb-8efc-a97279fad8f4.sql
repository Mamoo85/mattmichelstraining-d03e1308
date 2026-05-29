
-- Create shared_workout_results table for community workout sharing
CREATE TABLE IF NOT EXISTS public.shared_workout_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  workout_log_id uuid REFERENCES public.workout_logs(id) ON DELETE CASCADE,
  workout_title text NOT NULL DEFAULT '',
  caption text DEFAULT '',
  image_url text,
  image_status text NOT NULL DEFAULT 'no_image',
  stats jsonb NOT NULL DEFAULT '{}',
  exercises jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.shared_workout_results ENABLE ROW LEVEL SECURITY;

-- Users can insert their own shared results
CREATE POLICY "Users insert own shared results"
ON public.shared_workout_results FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Anyone authenticated can read approved or no-image results, plus own
CREATE POLICY "Read shared results"
ON public.shared_workout_results FOR SELECT
TO authenticated
USING (
  image_status IN ('no_image', 'approved')
  OR user_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
);

-- Admins can update (for image moderation)
CREATE POLICY "Admins update shared results"
ON public.shared_workout_results FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Users can delete their own shared results
CREATE POLICY "Users delete own shared results"
ON public.shared_workout_results FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- Update award_points function to include share_workout in valid actions
CREATE OR REPLACE FUNCTION public.award_points(_user_id uuid, _action text, _points integer, _description text DEFAULT ''::text, _reference_id text DEFAULT NULL::text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  new_total INTEGER;
  new_level TEXT;
  valid_actions TEXT[] := ARRAY['workout_log', 'studio_checkin', 'community_workout', 'workout_scan', 'challenge_entry', 'weekly_streak', 'membership', 'program_purchase', 'admin_award', 'admin_deduct', 'referral_bonus', 'share_workout'];
  is_admin BOOLEAN;
  caller_role TEXT;
BEGIN
  caller_role := current_setting('request.jwt.claim.role', true);
  is_admin := has_role(auth.uid(), 'admin');

  IF caller_role != 'service_role' AND NOT is_admin THEN
    RAISE EXCEPTION 'Forbidden: only admins and server functions can award points';
  END IF;

  IF NOT (_action = ANY(valid_actions)) THEN
    RAISE EXCEPTION 'Invalid action: %', _action;
  END IF;

  IF _points < 0 AND NOT is_admin THEN
    RAISE EXCEPTION 'Cannot award negative points';
  END IF;

  INSERT INTO public.user_points (user_id, total_points)
  VALUES (_user_id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.point_transactions (user_id, action, points, description, reference_id)
  VALUES (_user_id, _action, _points, _description, _reference_id)
  ON CONFLICT DO NOTHING;

  UPDATE public.user_points
  SET total_points = total_points + _points
  WHERE user_id = _user_id
  RETURNING total_points INTO new_total;

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
$function$;
