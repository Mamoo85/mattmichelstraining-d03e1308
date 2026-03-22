
-- Enforce sender_role server-side on lift_messages
CREATE OR REPLACE FUNCTION public.enforce_sender_role_lift_messages()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF has_role(auth.uid(), 'admin'::app_role) THEN
    NEW.sender_role := 'coach';
  ELSE
    NEW.sender_role := 'athlete';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_sender_role_lift_messages
  BEFORE INSERT ON public.lift_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_sender_role_lift_messages();

-- Enforce sender_role server-side on coach_direct_messages
CREATE OR REPLACE FUNCTION public.enforce_sender_role_coach_dm()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF has_role(auth.uid(), 'admin'::app_role) THEN
    NEW.sender_role := 'coach';
  ELSE
    NEW.sender_role := 'athlete';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_sender_role_coach_dm
  BEFORE INSERT ON public.coach_direct_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_sender_role_coach_dm();
