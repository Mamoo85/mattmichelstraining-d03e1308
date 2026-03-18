
-- FIX 1: Restrict user_points UPDATE to only allow is_public changes
DROP POLICY IF EXISTS "Users can toggle own visibility" ON public.user_points;
CREATE POLICY "Users can toggle own visibility"
  ON public.user_points FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND total_points = (SELECT up.total_points FROM public.user_points up WHERE up.user_id = auth.uid())
    AND level = (SELECT up.level FROM public.user_points up WHERE up.user_id = auth.uid())
    AND weekly_streak = (SELECT up.weekly_streak FROM public.user_points up WHERE up.user_id = auth.uid())
  );

-- FIX 2: Restrict challenge_participants UPDATE to only allow is_public changes (not current_value)
DROP POLICY IF EXISTS "Users can update own participation" ON public.challenge_participants;
CREATE POLICY "Users can update own participation"
  ON public.challenge_participants FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND current_value = (SELECT cp.current_value FROM public.challenge_participants cp WHERE cp.user_id = auth.uid() AND cp.challenge_id = challenge_participants.challenge_id)
  );

-- FIX 3: Change user_points public read to authenticated only
DROP POLICY IF EXISTS "Anyone can view public points" ON public.user_points;
CREATE POLICY "Authenticated can view public points"
  ON public.user_points FOR SELECT
  TO authenticated
  USING (is_public = true);

-- FIX 4: Default is_public to false on user_points
ALTER TABLE public.user_points ALTER COLUMN is_public SET DEFAULT false;
