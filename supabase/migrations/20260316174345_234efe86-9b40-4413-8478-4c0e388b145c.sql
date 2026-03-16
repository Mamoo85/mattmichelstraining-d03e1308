
-- 1. Purchased programs table: links users to programs they bought via Stripe
CREATE TABLE public.purchased_programs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  program_title TEXT NOT NULL,
  program_type TEXT NOT NULL DEFAULT 'custom',
  sport TEXT,
  exercises JSONB NOT NULL DEFAULT '[]'::jsonb,
  stripe_session_id TEXT,
  purchased_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes_from_matt TEXT
);

-- RLS
ALTER TABLE public.purchased_programs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own purchased programs"
  ON public.purchased_programs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all purchased programs"
  ON public.purchased_programs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert purchased programs"
  ON public.purchased_programs FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role can insert purchased programs"
  ON public.purchased_programs FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Admins can update purchased programs"
  ON public.purchased_programs FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 2. Lift messages table: bi-directional Q&A on specific lifts
CREATE TABLE public.lift_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  progress_log_id UUID REFERENCES public.progress_logs(id) ON DELETE CASCADE NOT NULL,
  user_id UUID NOT NULL,
  sender_id UUID NOT NULL,
  sender_role TEXT NOT NULL DEFAULT 'athlete',
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.lift_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own lift messages"
  ON public.lift_messages FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can insert messages on their own lifts"
  ON public.lift_messages FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can update their own lift messages"
  ON public.lift_messages FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- Enable realtime for lift_messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.lift_messages;

-- 3. Trigger: notify admin when athlete sends a question
CREATE OR REPLACE FUNCTION public.notify_on_lift_question()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  exercise TEXT;
  log_date TEXT;
  admin_ids UUID[];
BEGIN
  -- Only notify when athlete sends a message
  IF NEW.sender_role = 'athlete' THEN
    SELECT p.exercise_name, to_char(p.logged_at, 'Mon DD')
    INTO exercise, log_date
    FROM public.progress_logs p
    WHERE p.id = NEW.progress_log_id;

    -- Get all admin user_ids
    SELECT array_agg(ur.user_id) INTO admin_ids
    FROM public.user_roles ur WHERE ur.role = 'admin';

    -- Notify each admin
    IF admin_ids IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, type, title, body, link)
      SELECT unnest(admin_ids), 'lift_question', 'Athlete Question',
        'An athlete asked about their ' || COALESCE(exercise, 'lift') || ' from ' || COALESCE(log_date, 'recent session'),
        '/progress';
    END IF;
  END IF;

  -- Notify athlete when coach replies
  IF NEW.sender_role = 'coach' THEN
    SELECT p.exercise_name, to_char(p.logged_at, 'Mon DD')
    INTO exercise, log_date
    FROM public.progress_logs p
    WHERE p.id = NEW.progress_log_id;

    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (
      NEW.user_id,
      'coach_reply',
      'Coach Replied',
      'Matt replied to your question about ' || COALESCE(exercise, 'lift') || ' from ' || COALESCE(log_date, 'recent session'),
      '/progress'
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_lift_message_notification
  AFTER INSERT ON public.lift_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_lift_question();
