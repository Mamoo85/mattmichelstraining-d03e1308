CREATE TABLE public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  activity_type TEXT NOT NULL DEFAULT 'mixed',
  intensity TEXT DEFAULT 'moderate',
  weight_level TEXT,
  duration_minutes INTEGER,
  exercises_mentioned TEXT[],
  ai_summary TEXT,
  ai_recovery_tips TEXT,
  logged_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own activity logs" ON public.activity_logs
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users can insert own activity logs" ON public.activity_logs
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can read all activity logs" ON public.activity_logs
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));