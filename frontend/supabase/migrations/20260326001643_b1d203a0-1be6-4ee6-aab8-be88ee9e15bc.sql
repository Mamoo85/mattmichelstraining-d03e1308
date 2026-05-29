
-- Add is_public column defaulting to false
ALTER TABLE public.shared_workout_results ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false;

-- Drop the overly permissive read policy
DROP POLICY IF EXISTS "Read shared results" ON public.shared_workout_results;

-- Owner can always read their own results
CREATE POLICY "Owner can read own results"
ON public.shared_workout_results
FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- Anyone authenticated can read explicitly shared results
CREATE POLICY "Authenticated users can read public results"
ON public.shared_workout_results
FOR SELECT TO authenticated
USING (is_public = true);
