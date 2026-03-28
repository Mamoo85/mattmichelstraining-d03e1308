
-- Activity feed notes: generic notes/flags/questions for any activity item
CREATE TABLE public.activity_feed_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_type text NOT NULL,
  activity_id text NOT NULL,
  user_id uuid NOT NULL,
  author_id uuid NOT NULL,
  author_role text NOT NULL DEFAULT 'coach',
  note text NOT NULL,
  is_flagged boolean NOT NULL DEFAULT false,
  is_question boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.activity_feed_notes ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "Admins can manage activity feed notes" ON public.activity_feed_notes
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Users can read their own notes
CREATE POLICY "Users can read own activity feed notes" ON public.activity_feed_notes
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Users can insert notes on their own activities (for asking questions)
CREATE POLICY "Users can add notes on own activities" ON public.activity_feed_notes
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_feed_notes;
