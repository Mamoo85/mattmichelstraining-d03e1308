
-- Add indexes on frequently queried foreign keys
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles (user_id);
CREATE INDEX IF NOT EXISTS idx_workout_logs_user_id ON public.workout_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_workout_logs_date ON public.workout_logs (user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_logged_exercises_log_id ON public.logged_exercises (log_id);
CREATE INDEX IF NOT EXISTS idx_progress_logs_user_id ON public.progress_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_progress_logs_exercise ON public.progress_logs (user_id, exercise_name);
CREATE INDEX IF NOT EXISTS idx_program_workouts_program ON public.program_workouts (program_id, week_number, day_number);
CREATE INDEX IF NOT EXISTS idx_user_active_programs_user ON public.user_active_programs (user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications (user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_coach_dm_user ON public.coach_direct_messages (user_id);
CREATE INDEX IF NOT EXISTS idx_point_transactions_user ON public.point_transactions (user_id);
CREATE INDEX IF NOT EXISTS idx_challenge_participants_user ON public.challenge_participants (user_id);
CREATE INDEX IF NOT EXISTS idx_program_messages_program ON public.program_messages (program_id);
CREATE INDEX IF NOT EXISTS idx_session_bookings_user ON public.session_bookings (user_id);
CREATE INDEX IF NOT EXISTS idx_session_bookings_date ON public.session_bookings (slot_date);
CREATE INDEX IF NOT EXISTS idx_schedule_slots_date ON public.schedule_slots (slot_date);
CREATE INDEX IF NOT EXISTS idx_lift_messages_log ON public.lift_messages (progress_log_id);
CREATE INDEX IF NOT EXISTS idx_coach_notes_log ON public.coach_notes (progress_log_id);
CREATE INDEX IF NOT EXISTS idx_exercise_library_fix_it ON public.exercise_library (is_fix_it) WHERE is_fix_it = true;
