
-- 1. Add source_type column
ALTER TABLE public.community_workouts 
  ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'manual';

-- 2. Change is_public default to false
ALTER TABLE public.community_workouts 
  ALTER COLUMN is_public SET DEFAULT false;

-- 3. Backfill existing data
UPDATE public.community_workouts 
SET source_type = 'coach_seeded' 
WHERE creator_name = 'Coach Matt';

UPDATE public.community_workouts 
SET source_type = 'ai_fixit' 
WHERE creator_name = 'Coach Matt AI' 
  AND (
    lower(title) LIKE '%protocol%' 
    OR lower(title) LIKE '%fasciitis%' 
    OR lower(title) LIKE '%rehab%' 
    OR lower(title) LIKE '%impingement%' 
    OR lower(title) LIKE '%pain%'
    OR lower(title) LIKE '%fix%'
    OR lower(title) LIKE '%corrective%'
    OR lower(title) LIKE '%tendon%'
    OR lower(title) LIKE '%stability%'
    OR lower(title) LIKE '%concussion%'
    OR lower(title) LIKE '%ankle%'
    OR lower(title) LIKE '%shoulder%'
    OR lower(title) LIKE '%knee%'
    OR lower(title) LIKE '%back pain%'
    OR lower(title) LIKE '%acl%'
  );

UPDATE public.community_workouts 
SET source_type = 'ai_workout' 
WHERE creator_name = 'Coach Matt AI' 
  AND source_type = 'manual';

-- 4. Set is_public = false on all AI-generated rows
UPDATE public.community_workouts 
SET is_public = false 
WHERE source_type IN ('ai_workout', 'ai_fixit');

-- 5. Drop old RLS select policy and create new one that restricts community to manual only
DROP POLICY IF EXISTS "Anyone can view public community workouts" ON public.community_workouts;
DROP POLICY IF EXISTS "Users can view public workouts" ON public.community_workouts;
DROP POLICY IF EXISTS "Public workouts visible to all" ON public.community_workouts;

CREATE POLICY "Public manual workouts visible to all"
ON public.community_workouts
FOR SELECT
TO authenticated
USING (
  (is_public = true AND source_type = 'manual')
  OR user_id = auth.uid()
);
