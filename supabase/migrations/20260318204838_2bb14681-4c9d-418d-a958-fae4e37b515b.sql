
-- 1. Add missing columns to monthly_focus
ALTER TABLE public.monthly_focus
  ADD COLUMN IF NOT EXISTS metric_label text NOT NULL DEFAULT 'reps',
  ADD COLUMN IF NOT EXISTS target_goal numeric NOT NULL DEFAULT 0;

-- 2. Create focus_logs table (the user ledger)
CREATE TABLE public.focus_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  focus_id uuid NOT NULL REFERENCES public.monthly_focus(id) ON DELETE CASCADE,
  metric_value numeric NOT NULL DEFAULT 0,
  logged_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, focus_id, logged_date)
);

-- 3. Enable RLS
ALTER TABLE public.focus_logs ENABLE ROW LEVEL SECURITY;

-- 4. RLS: Users can only read their own logs
CREATE POLICY "Users can view own focus logs"
  ON public.focus_logs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- 5. RLS: Users can only insert their own logs
CREATE POLICY "Users can insert own focus logs"
  ON public.focus_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 6. RLS: Users can update own logs (same day correction)
CREATE POLICY "Users can update own focus logs"
  ON public.focus_logs FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- 7. RLS: Admins full access
CREATE POLICY "Admins can manage all focus logs"
  ON public.focus_logs FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
