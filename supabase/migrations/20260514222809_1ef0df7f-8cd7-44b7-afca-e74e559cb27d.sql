-- Adds the openrouter_record_blocked RPC used by the new hard-cap gate.
CREATE OR REPLACE FUNCTION public.openrouter_record_blocked()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _today date := (now() AT TIME ZONE 'America/Detroit')::date;
BEGIN
  INSERT INTO public.openrouter_daily_spend (day, total_usd, call_count, blocked_count)
  VALUES (_today, 0, 0, 1)
  ON CONFLICT (day) DO UPDATE
    SET blocked_count = openrouter_daily_spend.blocked_count + 1,
        updated_at = now();
END;
$$;