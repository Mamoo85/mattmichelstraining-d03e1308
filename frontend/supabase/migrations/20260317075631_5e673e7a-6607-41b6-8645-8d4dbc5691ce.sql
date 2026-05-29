
CREATE TABLE public.tier_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_key text NOT NULL,
  feature_label text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  tier_basic boolean NOT NULL DEFAULT false,
  tier_pro boolean NOT NULL DEFAULT false,
  tier_elite boolean NOT NULL DEFAULT false,
  tier_team boolean NOT NULL DEFAULT false,
  tier_legend boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(feature_key)
);

ALTER TABLE public.tier_features ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read tier features" ON public.tier_features
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Admins can manage tier features" ON public.tier_features
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Seed with current feature gates
INSERT INTO public.tier_features (feature_key, feature_label, description, tier_basic, tier_pro, tier_elite, tier_team, tier_legend, sort_order) VALUES
  ('exercise_library', 'Exercise Library', 'Access to the full exercise library', true, true, true, true, true, 1),
  ('monthly_focus', 'Monthly Focus', 'Monthly training focus plans', true, true, true, true, true, 2),
  ('custom_programming', 'Custom Programming', 'AI-generated custom programs', false, true, true, true, true, 3),
  ('fix_it_library', 'Fix It Library', 'Corrective exercise video library', false, true, true, true, true, 4),
  ('flag_coach', 'Flag for Coach', 'Flag exercises for coach review', false, true, true, true, true, 5),
  ('coach_messaging', 'Coach Messaging', 'Direct messaging with Coach Matt', false, false, true, true, true, 6),
  ('form_checks', 'Form Checks', 'Submit videos for form review', false, false, true, true, true, 7),
  ('priority_scheduling', 'Priority Scheduling', 'Priority access to session booking', false, false, false, true, true, 8),
  ('team_management', 'Team Management', 'Manage team rosters and programs', false, false, false, true, true, 9),
  ('progress_tracking', 'Progress Tracking', 'Full lift progress charts and history', true, true, true, true, true, 10),
  ('challenges', 'Monthly Challenges', 'Participate in monthly challenges', true, true, true, true, true, 11),
  ('workout_logger', 'Workout Logger', 'Log workouts with exercise picker', true, true, true, true, true, 12);
