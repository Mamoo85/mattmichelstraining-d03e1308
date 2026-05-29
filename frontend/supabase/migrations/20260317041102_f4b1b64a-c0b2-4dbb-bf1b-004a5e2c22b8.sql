
-- Monthly challenges table (admin-created each month)
CREATE TABLE public.monthly_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  metric_label text NOT NULL DEFAULT 'reps',
  month integer NOT NULL,
  year integer NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (month, year)
);

ALTER TABLE public.monthly_challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active challenges" ON public.monthly_challenges
  FOR SELECT TO authenticated USING (is_active = true);

CREATE POLICY "Admins can manage challenges" ON public.monthly_challenges
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Monthly focus table (AI-generated, admin-approved)
CREATE TABLE public.monthly_focus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month integer NOT NULL,
  year integer NOT NULL,
  title text NOT NULL,
  topic text NOT NULL DEFAULT '',
  reasoning text NOT NULL DEFAULT '',
  exercises text[] NOT NULL DEFAULT '{}',
  matt_quote text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  approved_by uuid,
  approved_at timestamptz,
  UNIQUE (month, year)
);

ALTER TABLE public.monthly_focus ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view published focus" ON public.monthly_focus
  FOR SELECT TO authenticated USING (status = 'published');

CREATE POLICY "Admins can manage focus" ON public.monthly_focus
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Add challenge_id FK to challenge_participants
ALTER TABLE public.challenge_participants
  ADD COLUMN monthly_challenge_id uuid REFERENCES public.monthly_challenges(id);

-- Challenge history/entries for timestamped logging
CREATE TABLE public.challenge_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id uuid NOT NULL REFERENCES public.challenge_participants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  value integer NOT NULL DEFAULT 0,
  logged_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.challenge_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own entries" ON public.challenge_entries
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own entries" ON public.challenge_entries
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all entries" ON public.challenge_entries
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Public entries visible" ON public.challenge_entries
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.challenge_participants cp
    WHERE cp.id = challenge_entries.participant_id AND cp.is_public = true
  ));
