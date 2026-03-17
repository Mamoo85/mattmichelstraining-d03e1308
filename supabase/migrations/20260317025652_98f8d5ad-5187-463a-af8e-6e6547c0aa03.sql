
-- Create a function + trigger to notify on new program activation
CREATE OR REPLACE FUNCTION public.notify_program_welcome()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  prog_title TEXT;
  user_email TEXT;
BEGIN
  -- Get program title
  SELECT title INTO prog_title FROM public.training_programs WHERE id = NEW.program_id;
  -- Get user email
  SELECT email INTO user_email FROM public.profiles WHERE user_id = NEW.user_id LIMIT 1;

  -- Insert a notification so the edge function can pick it up
  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (
    NEW.user_id,
    'program_welcome',
    'Welcome to ' || COALESCE(prog_title, 'your program'),
    user_email || '|' || COALESCE(prog_title, 'your program'),
    '/dashboard'
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_program_activation
  AFTER INSERT ON public.user_active_programs
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_program_welcome();
