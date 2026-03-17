
-- Points system tables for M² gamification engine

-- 1. User points summary (all-time totals + level)
CREATE TABLE public.user_points (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  total_points INTEGER NOT NULL DEFAULT 0,
  level TEXT NOT NULL DEFAULT 'rookie',
  weekly_streak INTEGER NOT NULL DEFAULT 0,
  last_streak_week TEXT,
  is_public BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_points ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own points" ON public.user_points FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own points" ON public.user_points FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own points" ON public.user_points FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can manage all points" ON public.user_points FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Anyone can view public points" ON public.user_points FOR SELECT USING (is_public = true);
CREATE POLICY "Service role manages points" ON public.user_points FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TRIGGER update_user_points_updated_at BEFORE UPDATE ON public.user_points FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Point transactions log (every point earned)
CREATE TABLE public.point_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  action TEXT NOT NULL,
  points INTEGER NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  reference_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.point_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own transactions" ON public.point_transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own transactions" ON public.point_transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can manage all transactions" ON public.point_transactions FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Service role manages transactions" ON public.point_transactions FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX idx_point_transactions_user ON public.point_transactions (user_id);
CREATE INDEX idx_point_transactions_action ON public.point_transactions (action);

-- 3. Function to award points and update totals + level
CREATE OR REPLACE FUNCTION public.award_points(
  _user_id UUID,
  _action TEXT,
  _points INTEGER,
  _description TEXT DEFAULT '',
  _reference_id TEXT DEFAULT NULL
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_total INTEGER;
  new_level TEXT;
BEGIN
  -- Ensure user_points row exists
  INSERT INTO public.user_points (user_id, total_points)
  VALUES (_user_id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  -- Insert transaction
  INSERT INTO public.point_transactions (user_id, action, points, description, reference_id)
  VALUES (_user_id, _action, _points, _description, _reference_id);

  -- Update total
  UPDATE public.user_points
  SET total_points = total_points + _points
  WHERE user_id = _user_id
  RETURNING total_points INTO new_total;

  -- Calculate level
  new_level := CASE
    WHEN new_total >= 10000 THEN 'legend'
    WHEN new_total >= 4000 THEN 'beast'
    WHEN new_total >= 1500 THEN 'competitor'
    WHEN new_total >= 500 THEN 'grinder'
    ELSE 'rookie'
  END;

  UPDATE public.user_points SET level = new_level WHERE user_id = _user_id;

  RETURN new_total;
END;
$$;
