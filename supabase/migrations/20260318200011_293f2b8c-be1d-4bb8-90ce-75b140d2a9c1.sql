
-- Insert missing exercises
INSERT INTO public.exercise_library (title, the_why, level, equipment_needed, focus_area, sport, client_type)
VALUES
  ('KB Goblet Squat', 'Teaches proper squat mechanics with an anterior load that cues upright posture and core engagement.', 'Beginner', 'Kettlebell', ARRAY['Strength'], ARRAY['General'], ARRAY['Beginner','Adult']),
  ('DB Floor Press', 'Limits range of motion to protect shoulders while building pressing strength and tricep lockout power.', 'Beginner', 'Dumbbells', ARRAY['Strength'], ARRAY['General'], ARRAY['Beginner','Adult']),
  ('RKC Plank', 'A maximal-tension plank that teaches full-body bracing — far more effective than a standard plank for core stability.', 'Beginner', 'None', ARRAY['Strength','Balance'], ARRAY['General'], ARRAY['Beginner','Adult']),
  ('DB Romanian Deadlift', 'Builds posterior chain strength and teaches the hip hinge pattern critical for all athletic movement.', 'Beginner', 'Dumbbells', ARRAY['Strength'], ARRAY['General'], ARRAY['Beginner','Adult']),
  ('Inverted TRX Row', 'Builds upper back and grip strength with bodyweight, scalable by adjusting body angle.', 'Beginner', 'TRX / Suspension Trainer', ARRAY['Strength'], ARRAY['General'], ARRAY['Beginner','Adult']),
  ('DB Reverse Lunge', 'A knee-friendly lunge variation that builds single-leg strength and balance while reducing shear forces.', 'Beginner', 'Dumbbells', ARRAY['Strength','Balance'], ARRAY['General'], ARRAY['Beginner','Adult']),
  ('Half-Kneeling DB Press', 'Trains pressing strength in a position that exposes and corrects core and hip stability imbalances.', 'Beginner', 'Dumbbells', ARRAY['Strength','Balance'], ARRAY['General'], ARRAY['Beginner','Adult']),
  ('Double KB Front Squat', 'Anterior-loaded squat variation that demands core strength, thoracic extension, and proper breathing mechanics.', 'Intermediate', 'Kettlebells', ARRAY['Strength','Power'], ARRAY['General'], ARRAY['Intermediate','Adult']),
  ('DB Incline Bench Press', 'Targets the upper chest and anterior deltoids while reducing shoulder joint stress compared to flat pressing.', 'Intermediate', 'Dumbbells, Incline Bench', ARRAY['Strength'], ARRAY['General'], ARRAY['Intermediate','Adult']),
  ('Ab Wheel Rollout', 'One of the most effective anti-extension core exercises — builds anterior core strength that transfers to all lifts.', 'Intermediate', 'Ab Wheel', ARRAY['Strength'], ARRAY['General'], ARRAY['Intermediate','Adult']),
  ('Neutral Grip Pull-Up', 'The most joint-friendly pull-up variation — builds lat and bicep strength while reducing shoulder and wrist stress.', 'Intermediate', 'Pull-Up Bar', ARRAY['Strength'], ARRAY['General'], ARRAY['Intermediate','Adult']),
  ('Single-Arm DB Row', 'Builds unilateral back strength, corrects imbalances, and teaches proper scapular retraction and depression.', 'Intermediate', 'Dumbbell, Bench', ARRAY['Strength'], ARRAY['General'], ARRAY['Intermediate','Adult']);

-- Now insert program_workouts linking exercises to the Foundation Block
-- Program ID: 50dbe5c6-8ce9-4696-9c05-cdd2deb39485

-- PHASE 1: Weeks 1-4
-- Week 1 Day 1
INSERT INTO public.program_workouts (program_id, week_number, day_number, exercise_id, prescribed_sets_reps, coach_instructions, sort_order)
SELECT '50dbe5c6-8ce9-4696-9c05-cdd2deb39485', w, 1, id, '3 x 10-12', 'Main Lower — Focus on depth and a controlled tempo. Sit back into your heels.', 1
FROM exercise_library, generate_series(1,4) AS w WHERE title = 'KB Goblet Squat';

INSERT INTO public.program_workouts (program_id, week_number, day_number, exercise_id, prescribed_sets_reps, coach_instructions, sort_order)
SELECT '50dbe5c6-8ce9-4696-9c05-cdd2deb39485', w, 1, id, '3 x 10-12', 'Main Upper — Keep elbows at 45°. Pause briefly at the bottom position.', 2
FROM exercise_library, generate_series(1,4) AS w WHERE title = 'DB Floor Press';

INSERT INTO public.program_workouts (program_id, week_number, day_number, exercise_id, prescribed_sets_reps, coach_instructions, sort_order)
SELECT '50dbe5c6-8ce9-4696-9c05-cdd2deb39485', w, 1, id, '3 x 30 seconds', 'Accessory — Squeeze every muscle. Glutes, quads, fists. Maximum tension.', 3
FROM exercise_library, generate_series(1,4) AS w WHERE title = 'RKC Plank';

-- Week 1 Day 2
INSERT INTO public.program_workouts (program_id, week_number, day_number, exercise_id, prescribed_sets_reps, coach_instructions, sort_order)
SELECT '50dbe5c6-8ce9-4696-9c05-cdd2deb39485', w, 2, id, '3 x 10-12', 'Main Lower — Hinge at the hips, not the back. Feel the hamstrings load on the way down.', 1
FROM exercise_library, generate_series(1,4) AS w WHERE title = 'DB Romanian Deadlift';

INSERT INTO public.program_workouts (program_id, week_number, day_number, exercise_id, prescribed_sets_reps, coach_instructions, sort_order)
SELECT '50dbe5c6-8ce9-4696-9c05-cdd2deb39485', w, 2, id, '3 x 10-12', 'Main Upper — Adjust body angle to scale difficulty. Pull chest to handles.', 2
FROM exercise_library, generate_series(1,4) AS w WHERE title = 'Inverted TRX Row';

INSERT INTO public.program_workouts (program_id, week_number, day_number, exercise_id, prescribed_sets_reps, coach_instructions, sort_order)
SELECT '50dbe5c6-8ce9-4696-9c05-cdd2deb39485', w, 2, (SELECT id FROM exercise_library WHERE title = 'Farmer''s Carry' LIMIT 1), '3 x 40 yards', 'Accessory — Tall posture, packed shoulders, crush the handles. Walk with purpose.', 3
FROM generate_series(1,4) AS w;

-- Week 1 Day 3
INSERT INTO public.program_workouts (program_id, week_number, day_number, exercise_id, prescribed_sets_reps, coach_instructions, sort_order)
SELECT '50dbe5c6-8ce9-4696-9c05-cdd2deb39485', w, 3, id, '3 x 10-12', 'Main Lower — Step back, not forward. Knee kisses the floor. Control the descent.', 1
FROM exercise_library, generate_series(1,4) AS w WHERE title = 'DB Reverse Lunge';

INSERT INTO public.program_workouts (program_id, week_number, day_number, exercise_id, prescribed_sets_reps, coach_instructions, sort_order)
SELECT '50dbe5c6-8ce9-4696-9c05-cdd2deb39485', w, 3, id, '3 x 10-12', 'Main Upper — Squeeze the glute on the down knee side. Press straight up, not forward.', 2
FROM exercise_library, generate_series(1,4) AS w WHERE title = 'Half-Kneeling DB Press';

INSERT INTO public.program_workouts (program_id, week_number, day_number, exercise_id, prescribed_sets_reps, coach_instructions, sort_order)
SELECT '50dbe5c6-8ce9-4696-9c05-cdd2deb39485', w, 3, (SELECT id FROM exercise_library WHERE title = 'Pallof Press' LIMIT 1), '3 x 10-12 per side', 'Accessory — Press out and hold. Resist rotation. This is anti-rotation training.', 3
FROM generate_series(1,4) AS w;

-- PHASE 2: Weeks 5-8
-- Day 1
INSERT INTO public.program_workouts (program_id, week_number, day_number, exercise_id, prescribed_sets_reps, coach_instructions, sort_order)
SELECT '50dbe5c6-8ce9-4696-9c05-cdd2deb39485', w, 1, id, '4 x 6-8', 'Main Lower — Brace hard before each rep. Elbows high, sit between your heels.', 1
FROM exercise_library, generate_series(5,8) AS w WHERE title = 'Double KB Front Squat';

INSERT INTO public.program_workouts (program_id, week_number, day_number, exercise_id, prescribed_sets_reps, coach_instructions, sort_order)
SELECT '50dbe5c6-8ce9-4696-9c05-cdd2deb39485', w, 1, id, '4 x 6-8', 'Main Upper — Bench at 30-45°. Full range of motion. Control the negative.', 2
FROM exercise_library, generate_series(5,8) AS w WHERE title = 'DB Incline Bench Press';

INSERT INTO public.program_workouts (program_id, week_number, day_number, exercise_id, prescribed_sets_reps, coach_instructions, sort_order)
SELECT '50dbe5c6-8ce9-4696-9c05-cdd2deb39485', w, 1, id, '4 x 8-10', 'Accessory — Squeeze glutes, brace core. Only go as far as you can control.', 3
FROM exercise_library, generate_series(5,8) AS w WHERE title = 'Ab Wheel Rollout';

-- Day 2
INSERT INTO public.program_workouts (program_id, week_number, day_number, exercise_id, prescribed_sets_reps, coach_instructions, sort_order)
SELECT '50dbe5c6-8ce9-4696-9c05-cdd2deb39485', w, 2, (SELECT id FROM exercise_library WHERE title = 'Trap Bar Deadlift (or Kettlebell Deadlift)' LIMIT 1), '4 x 6-8', 'Main Lower — Push the floor away. Lock out with glutes, not lower back.', 1
FROM generate_series(5,8) AS w;

INSERT INTO public.program_workouts (program_id, week_number, day_number, exercise_id, prescribed_sets_reps, coach_instructions, sort_order)
SELECT '50dbe5c6-8ce9-4696-9c05-cdd2deb39485', w, 2, id, '4 x 6-8', 'Main Upper — Use a band if needed. Dead hang at bottom, chin over bar at top.', 2
FROM exercise_library, generate_series(5,8) AS w WHERE title = 'Neutral Grip Pull-Up';

INSERT INTO public.program_workouts (program_id, week_number, day_number, exercise_id, prescribed_sets_reps, coach_instructions, sort_order)
SELECT '50dbe5c6-8ce9-4696-9c05-cdd2deb39485', w, 2, (SELECT id FROM exercise_library WHERE title = 'Suitcase Carry' LIMIT 1), '4 x 40 yards per side', 'Accessory — Walk tall, don''t lean to one side. Fight the lateral pull.', 3
FROM generate_series(5,8) AS w;

-- Day 3
INSERT INTO public.program_workouts (program_id, week_number, day_number, exercise_id, prescribed_sets_reps, coach_instructions, sort_order)
SELECT '50dbe5c6-8ce9-4696-9c05-cdd2deb39485', w, 3, (SELECT id FROM exercise_library WHERE title = 'Bulgarian Split Squat' LIMIT 1), '4 x 8-10 per leg', 'Main Lower — Rear foot elevated. Stay upright. Own the bottom position.', 1
FROM generate_series(5,8) AS w;

INSERT INTO public.program_workouts (program_id, week_number, day_number, exercise_id, prescribed_sets_reps, coach_instructions, sort_order)
SELECT '50dbe5c6-8ce9-4696-9c05-cdd2deb39485', w, 3, id, '4 x 8-10 per arm', 'Main Upper — Elbow tracks past your hip. Squeeze the shoulder blade at the top.', 2
FROM exercise_library, generate_series(5,8) AS w WHERE title = 'Single-Arm DB Row';

INSERT INTO public.program_workouts (program_id, week_number, day_number, exercise_id, prescribed_sets_reps, coach_instructions, sort_order)
SELECT '50dbe5c6-8ce9-4696-9c05-cdd2deb39485', w, 3, (SELECT id FROM exercise_library WHERE title = 'Hollow Body Holds' LIMIT 1), '4 x 30 seconds', 'Accessory — Lower back glued to floor. Arms overhead, legs extended. Total tension.', 3
FROM generate_series(5,8) AS w;
