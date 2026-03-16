
-- Notifications table for in-app alerts
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  type TEXT NOT NULL DEFAULT 'coach_note',
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user ON public.notifications(user_id, is_read, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can only see their own notifications
CREATE POLICY "Users can view their own notifications"
  ON public.notifications FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Users can mark their own as read
CREATE POLICY "Users can update their own notifications"
  ON public.notifications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- Only system/admin can insert
CREATE POLICY "Admins can insert notifications"
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Allow trigger (service role) to insert
CREATE POLICY "Service role can insert notifications"
  ON public.notifications FOR INSERT TO service_role
  WITH CHECK (true);

-- Trigger: auto-create notification when coach_note is inserted
CREATE OR REPLACE FUNCTION public.notify_on_coach_note()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  exercise TEXT;
  log_date TEXT;
BEGIN
  -- Look up the exercise name and date from the progress log
  SELECT p.exercise_name, to_char(p.logged_at, 'Mon DD')
  INTO exercise, log_date
  FROM public.progress_logs p
  WHERE p.id = NEW.progress_log_id;

  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (
    NEW.user_id,
    'coach_note',
    'New Coach Note',
    'Coach left a note on your ' || COALESCE(exercise, 'lift') || ' from ' || COALESCE(log_date, 'recent session'),
    '/progress'
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_coach_note_notification
  AFTER INSERT ON public.coach_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_coach_note();

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
