
-- Migration 1: Add columns to protocol_exercises
ALTER TABLE public.protocol_exercises 
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS exercise_library_id UUID REFERENCES public.exercise_library(id),
  ADD COLUMN IF NOT EXISTS coach_notes TEXT;

-- Migration 2: Add columns to protocols
ALTER TABLE public.protocols
  ADD COLUMN IF NOT EXISTS gifted_to UUID,
  ADD COLUMN IF NOT EXISTS gift_message TEXT,
  ADD COLUMN IF NOT EXISTS source_template_id UUID REFERENCES public.protocols(id);

-- Migration 3: Create protocol_exercise_flags table
CREATE TABLE IF NOT EXISTS public.protocol_exercise_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  protocol_exercise_id UUID REFERENCES public.protocol_exercises(id) ON DELETE CASCADE NOT NULL,
  user_id UUID NOT NULL,
  question TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  admin_response TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

ALTER TABLE public.protocol_exercise_flags ENABLE ROW LEVEL SECURITY;

-- Users can see their own flags
CREATE POLICY "Users can view own flags"
ON public.protocol_exercise_flags FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Users can create flags
CREATE POLICY "Users can create flags"
ON public.protocol_exercise_flags FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

-- Admins can update flags (respond)
CREATE POLICY "Admins can update flags"
ON public.protocol_exercise_flags FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Migration 4: Add protocol_id to user_content_access if not exists
ALTER TABLE public.user_content_access
  ADD COLUMN IF NOT EXISTS protocol_id UUID REFERENCES public.protocols(id);

-- Notify admins when exercise is flagged
CREATE OR REPLACE FUNCTION public.notify_on_exercise_flag()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ex_name TEXT;
  admin_ids UUID[];
BEGIN
  SELECT exercise_name INTO ex_name
  FROM public.protocol_exercises WHERE id = NEW.protocol_exercise_id;

  SELECT array_agg(ur.user_id) INTO admin_ids
  FROM public.user_roles ur WHERE ur.role = 'admin';

  IF admin_ids IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, body, link)
    SELECT unnest(admin_ids), 'exercise_flag',
      'Exercise Flagged: ' || COALESCE(ex_name, 'Unknown'),
      LEFT(NEW.question, 100),
      '/admin';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_exercise_flag
AFTER INSERT ON public.protocol_exercise_flags
FOR EACH ROW EXECUTE FUNCTION public.notify_on_exercise_flag();
