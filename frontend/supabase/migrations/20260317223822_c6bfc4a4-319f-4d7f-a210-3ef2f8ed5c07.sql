
ALTER TABLE public.workout_logs
  ADD COLUMN sleep_hours numeric NULL,
  ADD COLUMN sleep_quality integer NULL,
  ADD COLUMN soreness integer NULL,
  ADD COLUMN energy integer NULL,
  ADD COLUMN recovery_notes text NULL;
