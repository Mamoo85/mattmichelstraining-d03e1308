
-- Add 'coach' to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'coach';

-- Coach profiles table
CREATE TABLE public.coach_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  school_name TEXT NOT NULL DEFAULT '',
  sport TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  max_athletes INTEGER NOT NULL DEFAULT 50,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);
ALTER TABLE public.coach_profiles ENABLE ROW LEVEL SECURITY;

-- Coaches see own profile, admins see all
CREATE POLICY "Coaches view own profile" ON public.coach_profiles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage coach profiles" ON public.coach_profiles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Add columns to team_rosters
ALTER TABLE public.team_rosters
  ADD COLUMN IF NOT EXISTS coach_user_id UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS school_name TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS season TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS invite_code TEXT UNIQUE;

-- Team feed table
CREATE TABLE public.team_feed (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  roster_id UUID NOT NULL REFERENCES public.team_rosters(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  type TEXT NOT NULL DEFAULT 'shoutout',
  content TEXT NOT NULL DEFAULT '',
  media_url TEXT,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.team_feed ENABLE ROW LEVEL SECURITY;

-- Team members and coaches can view their team feed
CREATE POLICY "Team members view feed" ON public.team_feed
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.roster_id = team_feed.roster_id AND tm.athlete_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.team_rosters tr
      WHERE tr.id = team_feed.roster_id AND tr.coach_user_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin')
  );

-- Team members can post to their team feed
CREATE POLICY "Team members post to feed" ON public.team_feed
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND (
      EXISTS (
        SELECT 1 FROM public.team_members tm
        WHERE tm.roster_id = team_feed.roster_id AND tm.athlete_user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.team_rosters tr
        WHERE tr.id = team_feed.roster_id AND tr.coach_user_id = auth.uid()
      )
    )
  );

-- Admins full access
CREATE POLICY "Admins manage feed" ON public.team_feed
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Team feed reactions
CREATE TABLE public.team_feed_reactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  feed_item_id UUID NOT NULL REFERENCES public.team_feed(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  reaction TEXT NOT NULL DEFAULT 'fire',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(feed_item_id, user_id, reaction)
);
ALTER TABLE public.team_feed_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members manage reactions" ON public.team_feed_reactions
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Team members view reactions" ON public.team_feed_reactions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.team_feed tf
      JOIN public.team_members tm ON tm.roster_id = tf.roster_id
      WHERE tf.id = team_feed_reactions.feed_item_id AND tm.athlete_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.team_feed tf
      JOIN public.team_rosters tr ON tr.id = tf.roster_id
      WHERE tf.id = team_feed_reactions.feed_item_id AND tr.coach_user_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin')
  );

-- Team workouts (coach-assigned)
CREATE TABLE public.team_workouts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  roster_id UUID NOT NULL REFERENCES public.team_rosters(id) ON DELETE CASCADE,
  assigned_by UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  exercises JSONB NOT NULL DEFAULT '[]'::jsonb,
  due_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.team_workouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coach and athletes view team workouts" ON public.team_workouts
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.roster_id = team_workouts.roster_id AND tm.athlete_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.team_rosters tr
      WHERE tr.id = team_workouts.roster_id AND tr.coach_user_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Coaches assign workouts" ON public.team_workouts
  FOR INSERT TO authenticated
  WITH CHECK (
    assigned_by = auth.uid() AND (
      EXISTS (
        SELECT 1 FROM public.team_rosters tr
        WHERE tr.id = team_workouts.roster_id AND tr.coach_user_id = auth.uid()
      )
      OR public.has_role(auth.uid(), 'admin')
    )
  );

CREATE POLICY "Coaches update workouts" ON public.team_workouts
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.team_rosters tr
      WHERE tr.id = team_workouts.roster_id AND tr.coach_user_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Coaches delete workouts" ON public.team_workouts
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.team_rosters tr
      WHERE tr.id = team_workouts.roster_id AND tr.coach_user_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin')
  );

-- Team workout completions
CREATE TABLE public.team_workout_completions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_workout_id UUID NOT NULL REFERENCES public.team_workouts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT DEFAULT '',
  UNIQUE(team_workout_id, user_id)
);
ALTER TABLE public.team_workout_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Athletes log own completions" ON public.team_workout_completions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "View completions in team" ON public.team_workout_completions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.team_workouts tw
      JOIN public.team_members tm ON tm.roster_id = tw.roster_id
      WHERE tw.id = team_workout_completions.team_workout_id AND tm.athlete_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.team_workouts tw
      JOIN public.team_rosters tr ON tr.id = tw.roster_id
      WHERE tw.id = team_workout_completions.team_workout_id AND tr.coach_user_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin')
  );

-- Indexes for performance
CREATE INDEX idx_team_feed_roster ON public.team_feed(roster_id, created_at DESC);
CREATE INDEX idx_team_feed_reactions_item ON public.team_feed_reactions(feed_item_id);
CREATE INDEX idx_team_workouts_roster ON public.team_workouts(roster_id, due_date);
CREATE INDEX idx_team_workout_completions_workout ON public.team_workout_completions(team_workout_id);
CREATE INDEX idx_team_rosters_invite_code ON public.team_rosters(invite_code) WHERE invite_code IS NOT NULL;
CREATE INDEX idx_team_rosters_coach ON public.team_rosters(coach_user_id) WHERE coach_user_id IS NOT NULL;
CREATE INDEX idx_coach_profiles_user ON public.coach_profiles(user_id);

-- Function to check if user is a coach for a roster
CREATE OR REPLACE FUNCTION public.is_team_coach(_user_id UUID, _roster_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_rosters
    WHERE id = _roster_id AND coach_user_id = _user_id
  )
$$;

-- Function to check if user is a member of a roster
CREATE OR REPLACE FUNCTION public.is_team_member(_user_id UUID, _roster_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE roster_id = _roster_id AND athlete_user_id = _user_id
  )
$$;

-- Generate unique invite code for rosters
CREATE OR REPLACE FUNCTION public.generate_team_invite_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  code TEXT;
  tries INT := 0;
BEGIN
  IF NEW.invite_code IS NOT NULL THEN
    RETURN NEW;
  END IF;
  LOOP
    code := UPPER(SUBSTR(MD5(gen_random_uuid()::text), 1, 6));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.team_rosters WHERE invite_code = code);
    tries := tries + 1;
    EXIT WHEN tries > 20;
  END LOOP;
  NEW.invite_code := code;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_generate_invite_code
  BEFORE INSERT ON public.team_rosters
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_team_invite_code();
