CREATE OR REPLACE FUNCTION public.seed_welcome_workouts()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  template_id UUID;
  proto_title TEXT;
  proto_desc TEXT;
  proto_exercises JSONB := '[]'::jsonb;
  ex RECORD;
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
      {"title":"Round 1: Hang Cleans","sets":"1","reps":"10","notes":"Explosive hip extension, catch in front rack"},
      {"title":"Burpees","sets":"1","reps":"10","notes":"Full chest-to-floor, jump at top"},
      {"title":"Round 2: Hang Clean Front Squats","sets":"1","reps":"10","notes":"Clean into front squat, full depth"},
      {"title":"Burpees","sets":"1","reps":"10","notes":"Stay controlled, breathe at the top"},
      {"title":"Round 3: Hang Clean Presses","sets":"1","reps":"10","notes":"Clean and press overhead in one flow"},
      {"title":"Burpees","sets":"1","reps":"10","notes":"Pace yourself, almost there"},
      {"title":"Round 4: Hang Clean Front Squat Presses","sets":"1","reps":"10","notes":"The full combo — clean, squat, press. This is the finisher."},
      {"title":"Burpees","sets":"1","reps":"10","notes":"Last round. Empty the tank."}
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
      {"title":"Cat-Cow","sets":"6","reps":"10","notes":"Round 1-6. Slow spinal flexion/extension, breathe with each rep."},
      {"title":"Dead Bug","sets":"5","reps":"8 per side","notes":"Round 2-6. Keep low back pressed to floor, opposite arm/leg extend."},
      {"title":"Goblet Squat","sets":"4","reps":"10","notes":"Round 3-6. Hold weight at chest, sit between heels, chest up."},
      {"title":"Push-Up","sets":"3","reps":"8","notes":"Round 4-6. Full range, elbows at 45°. Drop to knees if needed."},
      {"title":"Band Pull-Apart","sets":"2","reps":"15","notes":"Round 5-6. Squeeze shoulder blades, keep arms straight."},
      {"title":"Plank Hold","sets":"1","reps":"30 sec","notes":"Round 6 only. Brace core, flat back, breathe steady. The summit."}
    ]'::jsonb
  );

  -- Default Protocol as a community workout
  SELECT id, title, description INTO template_id, proto_title, proto_desc
  FROM public.protocols
  WHERE is_default = true AND is_template = true
  LIMIT 1;

  IF template_id IS NOT NULL THEN
    FOR ex IN
      SELECT exercise_name, sets, reps, notes
      FROM public.protocol_exercises
      WHERE protocol_id = template_id
      ORDER BY sort_order
    LOOP
      proto_exercises := proto_exercises || jsonb_build_object(
        'title', ex.exercise_name,
        'sets', COALESCE(ex.sets::text, '3'),
        'reps', COALESCE(ex.reps, '10'),
        'notes', COALESCE(ex.notes, '')
      );
    END LOOP;

    INSERT INTO public.community_workouts (user_id, title, description, creator_name, is_public, exercises)
    VALUES (
      NEW.user_id,
      COALESCE(proto_title, 'Starter Program'),
      COALESCE(proto_desc, 'Your default starter workout from Coach Matt.'),
      'Coach Matt',
      false,
      proto_exercises
    );
  END IF;

  RETURN NEW;
END;
$function$;