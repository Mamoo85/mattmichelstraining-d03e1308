
-- Notify all authenticated users when a monthly focus is published
CREATE OR REPLACE FUNCTION public.notify_monthly_focus_published()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only fire when status changes to 'published'
  IF NEW.status = 'published' AND (OLD.status IS NULL OR OLD.status <> 'published') THEN
    INSERT INTO public.notifications (user_id, type, title, body, link)
    SELECT p.user_id, 'monthly_focus', 
      'New Monthly Focus: ' || NEW.title,
      'Matt just dropped the ' || to_char(to_date(NEW.month::text, 'MM'), 'Month') || 'focus — ' || NEW.topic || '. Check it out.',
      '/dashboard'
    FROM public.profiles p;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_monthly_focus
  AFTER INSERT OR UPDATE ON public.monthly_focus
  FOR EACH ROW EXECUTE FUNCTION public.notify_monthly_focus_published();

-- Notify all authenticated users when a monthly challenge is activated
CREATE OR REPLACE FUNCTION public.notify_monthly_challenge_activated()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only fire when is_active changes to true
  IF NEW.is_active = true AND (OLD IS NULL OR OLD.is_active = false) THEN
    INSERT INTO public.notifications (user_id, type, title, body, link)
    SELECT p.user_id, 'monthly_challenge',
      'New Challenge: ' || NEW.title,
      'A new monthly challenge just went live — ' || NEW.metric_label || ' based. Join and compete on the leaderboard!',
      '/dashboard'
    FROM public.profiles p;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_monthly_challenge
  AFTER INSERT OR UPDATE ON public.monthly_challenges
  FOR EACH ROW EXECUTE FUNCTION public.notify_monthly_challenge_activated();
