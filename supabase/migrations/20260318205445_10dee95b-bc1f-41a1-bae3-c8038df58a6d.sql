
-- Create a security definer function for logging challenge progress
-- This bypasses RLS so current_value can be updated server-side
CREATE OR REPLACE FUNCTION public.log_challenge_progress(
  _user_id uuid,
  _challenge_id text,
  _value integer
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _participant_id uuid;
  _new_value integer;
BEGIN
  -- Caller must be the user themselves
  IF _user_id != auth.uid() THEN
    RAISE EXCEPTION 'Forbidden: cannot log progress for another user';
  END IF;

  -- Get participant
  SELECT id, current_value INTO _participant_id, _new_value
  FROM public.challenge_participants
  WHERE user_id = _user_id AND challenge_id = _challenge_id;

  IF _participant_id IS NULL THEN
    RAISE EXCEPTION 'Not joined in this challenge';
  END IF;

  _new_value := _new_value + _value;

  -- Update current_value
  UPDATE public.challenge_participants
  SET current_value = _new_value, updated_at = now()
  WHERE id = _participant_id;

  -- Insert entry
  INSERT INTO public.challenge_entries (participant_id, user_id, value)
  VALUES (_participant_id, _user_id, _value);

  RETURN _new_value;
END;
$$;
