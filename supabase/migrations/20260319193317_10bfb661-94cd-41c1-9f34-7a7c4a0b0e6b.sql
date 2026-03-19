
-- posture_requests table
CREATE TABLE public.posture_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  front_photo_url TEXT,
  side_photo_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  analysis TEXT,
  promo_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.posture_requests ENABLE ROW LEVEL SECURITY;

-- Users can insert their own
CREATE POLICY "Users insert own posture requests"
  ON public.posture_requests FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can read their own
CREATE POLICY "Users read own posture requests"
  ON public.posture_requests FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Admins can update all
CREATE POLICY "Admins update posture requests"
  ON public.posture_requests FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Trigger to seed welcome workouts on new profile creation
CREATE OR REPLACE FUNCTION public.seed_welcome_workouts()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  -- Death by Hang Cleans
  INSERT INTO public.community_workouts (user_id, title, description, creator_name, is_public, exercises)
  VALUES (
    NEW.user_id,
    'Death by Hang Cleans',
    'Welcome gift from Coach Matt. 4 brutal rounds mixing hang clean variations with burpees. 10 reps each movement, no rest between exercises.',
    'Coach Matt',
    false,
    '[
      {"name":"Round 1: Hang Cleans","sets":"1","reps":"10","notes":"Explosive hip extension, catch in front rack"},
      {"name":"Burpees","sets":"1","reps":"10","notes":"Full chest-to-floor, jump at top"},
      {"name":"Round 2: Hang Clean Front Squats","sets":"1","reps":"10","notes":"Clean into front squat, full depth"},
      {"name":"Burpees","sets":"1","reps":"10","notes":"Stay controlled, breathe at the top"},
      {"name":"Round 3: Hang Clean Presses","sets":"1","reps":"10","notes":"Clean and press overhead in one flow"},
      {"name":"Burpees","sets":"1","reps":"10","notes":"Pace yourself, almost there"},
      {"name":"Round 4: Hang Clean Front Squat Presses","sets":"1","reps":"10","notes":"The full combo — clean, squat, press. This is the finisher."},
      {"name":"Burpees","sets":"1","reps":"10","notes":"Last round. Empty the tank."}
    ]'::jsonb
  );

  -- Matt's Mountain Workout (pyramid)
  INSERT INTO public.community_workouts (user_id, title, description, creator_name, is_public, exercises)
  VALUES (
    NEW.user_id,
    'Matt''s Mountain Workout',
    'Welcome gift from Coach Matt. A pyramid-style workout — each round adds one exercise. By round 6 you do all 6 movements. Beginner-friendly, mobility and core focused.',
    'Coach Matt',
    false,
    '[
      {"name":"Cat-Cow","sets":"6","reps":"10","notes":"Round 1-6. Slow spinal flexion/extension, breathe with each rep."},
      {"name":"Dead Bug","sets":"5","reps":"8 per side","notes":"Round 2-6. Keep low back pressed to floor, opposite arm/leg extend."},
      {"name":"Goblet Squat","sets":"4","reps":"10","notes":"Round 3-6. Hold weight at chest, sit between heels, chest up."},
      {"name":"Push-Up","sets":"3","reps":"8","notes":"Round 4-6. Full range, elbows at 45°. Drop to knees if needed."},
      {"name":"Band Pull-Apart","sets":"2","reps":"15","notes":"Round 5-6. Squeeze shoulder blades, keep arms straight."},
      {"name":"Plank Hold","sets":"1","reps":"30 sec","notes":"Round 6 only. Brace core, flat back, breathe steady. The summit."}
    ]'::jsonb
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_seed_welcome_workouts
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.seed_welcome_workouts();
