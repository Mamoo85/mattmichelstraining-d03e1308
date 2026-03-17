
-- 1. Create coach_direct_messages table for Elite/Team direct messaging
CREATE TABLE public.coach_direct_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  sender_id uuid NOT NULL,
  sender_role text NOT NULL DEFAULT 'athlete',
  message text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.coach_direct_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own direct messages"
  ON public.coach_direct_messages FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can insert direct messages"
  ON public.coach_direct_messages FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update direct messages"
  ON public.coach_direct_messages FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin') OR auth.uid() = user_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.coach_direct_messages;

-- 2. Add is_fix_it and fix_it_protocol to exercise_library
ALTER TABLE public.exercise_library ADD COLUMN is_fix_it boolean NOT NULL DEFAULT false;
ALTER TABLE public.exercise_library ADD COLUMN fix_it_protocol text[] NOT NULL DEFAULT '{}'::text[];
