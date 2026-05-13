CREATE TABLE IF NOT EXISTS public.openrouter_daily_spend (
  day date PRIMARY KEY,
  total_usd numeric NOT NULL DEFAULT 0,
  call_count integer NOT NULL DEFAULT 0,
  blocked_count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.openrouter_daily_spend ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role bypass" ON public.openrouter_daily_spend;
CREATE POLICY "service_role bypass" ON public.openrouter_daily_spend
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "admin read" ON public.openrouter_daily_spend;
CREATE POLICY "admin read" ON public.openrouter_daily_spend
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.openrouter_record_spend(_cost numeric)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _today date := (now() AT TIME ZONE 'America/Detroit')::date;
  _new_total numeric;
BEGIN
  INSERT INTO public.openrouter_daily_spend (day, total_usd, call_count)
  VALUES (_today, COALESCE(_cost, 0), 1)
  ON CONFLICT (day) DO UPDATE
    SET total_usd = openrouter_daily_spend.total_usd + COALESCE(EXCLUDED.total_usd, 0),
        call_count = openrouter_daily_spend.call_count + 1,
        updated_at = now()
  RETURNING total_usd INTO _new_total;
  RETURN _new_total;
END;
$$;

CREATE OR REPLACE FUNCTION public.openrouter_today_spend()
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(total_usd, 0)
  FROM public.openrouter_daily_spend
  WHERE day = (now() AT TIME ZONE 'America/Detroit')::date;
$$;