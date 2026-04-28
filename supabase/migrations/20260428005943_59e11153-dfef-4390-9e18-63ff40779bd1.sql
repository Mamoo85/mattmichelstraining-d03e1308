CREATE OR REPLACE FUNCTION public.increment_arm_sent(p_arm_key text, p_vertical text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.email_arm_stats (arm_key, vertical, sent, last_updated)
  VALUES (p_arm_key, p_vertical, 1, now())
  ON CONFLICT (arm_key, vertical)
  DO UPDATE SET sent = public.email_arm_stats.sent + 1, last_updated = now();
END;
$$;

REVOKE ALL ON FUNCTION public.increment_arm_sent(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_arm_sent(text, text) TO service_role;