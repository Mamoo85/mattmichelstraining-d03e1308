
-- Performance indexes for frequently queried columns

-- profiles: queried by user_id constantly
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles (user_id);

-- progress_logs: queried by user_id + ordered by logged_at
CREATE INDEX IF NOT EXISTS idx_progress_logs_user_id_logged_at ON public.progress_logs (user_id, logged_at DESC);

-- workout_logs: queried by user_id + ordered by date
CREATE INDEX IF NOT EXISTS idx_workout_logs_user_id_date ON public.workout_logs (user_id, date DESC);

-- notifications: queried by user_id + is_read
CREATE INDEX IF NOT EXISTS idx_notifications_user_id_read ON public.notifications (user_id, is_read) WHERE is_read = false;

-- parent_child_links: queried by parent_user_id
CREATE INDEX IF NOT EXISTS idx_parent_child_links_parent ON public.parent_child_links (parent_user_id);
CREATE INDEX IF NOT EXISTS idx_parent_child_links_child ON public.parent_child_links (child_user_id);

-- point_transactions: queried by user_id
CREATE INDEX IF NOT EXISTS idx_point_transactions_user_id ON public.point_transactions (user_id, created_at DESC);

-- coach_direct_messages: queried by user_id + is_read
CREATE INDEX IF NOT EXISTS idx_coach_dm_user_id ON public.coach_direct_messages (user_id, is_read);

-- exercise_library: filtered by is_fix_it, level, focus_area
CREATE INDEX IF NOT EXISTS idx_exercise_library_level ON public.exercise_library (level);
CREATE INDEX IF NOT EXISTS idx_exercise_library_fix_it ON public.exercise_library (is_fix_it) WHERE is_fix_it = true;

-- marketing_drafts: filtered by status
CREATE INDEX IF NOT EXISTS idx_marketing_drafts_status ON public.marketing_drafts (status);

-- service_catalog: filtered by is_active
CREATE INDEX IF NOT EXISTS idx_service_catalog_active ON public.service_catalog (is_active) WHERE is_active = true;

-- newsletter_subscribers: filtered by is_active
CREATE INDEX IF NOT EXISTS idx_newsletter_subs_active ON public.newsletter_subscribers (is_active) WHERE is_active = true;

-- logged_exercises: queried by log_id
CREATE INDEX IF NOT EXISTS idx_logged_exercises_log_id ON public.logged_exercises (log_id);

-- focus_logs: queried by user_id + focus_id
CREATE INDEX IF NOT EXISTS idx_focus_logs_user_focus ON public.focus_logs (user_id, focus_id);

-- challenge_participants: queried by user_id + challenge_id
CREATE INDEX IF NOT EXISTS idx_challenge_participants_user ON public.challenge_participants (user_id);

-- retention_alerts: filtered by status
CREATE INDEX IF NOT EXISTS idx_retention_alerts_status ON public.retention_alerts (status) WHERE status = 'active';
