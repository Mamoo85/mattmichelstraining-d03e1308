
-- Team rosters: one per Team-tier subscriber
CREATE TABLE public.team_rosters (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  team_name TEXT NOT NULL DEFAULT 'My Team',
  sport TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Team members: athletes on a roster
CREATE TABLE public.team_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  roster_id UUID NOT NULL REFERENCES public.team_rosters(id) ON DELETE CASCADE,
  athlete_email TEXT NOT NULL,
  athlete_user_id UUID,
  athlete_name TEXT,
  role TEXT NOT NULL DEFAULT 'athlete',
  status TEXT NOT NULL DEFAULT 'invited',
  invited_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  joined_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(roster_id, athlete_email)
);

-- RLS for team_rosters
ALTER TABLE public.team_rosters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage own rosters" ON public.team_rosters
  FOR ALL TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Admins can manage all rosters" ON public.team_rosters
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Team members can view their roster" ON public.team_rosters
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_members.roster_id = team_rosters.id
      AND team_members.athlete_user_id = auth.uid()
      AND team_members.status = 'active'
  ));

-- RLS for team_members
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Roster owners can manage members" ON public.team_members
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.team_rosters
    WHERE team_rosters.id = team_members.roster_id
      AND team_rosters.owner_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.team_rosters
    WHERE team_rosters.id = team_members.roster_id
      AND team_rosters.owner_id = auth.uid()
  ));

CREATE POLICY "Admins can manage all members" ON public.team_members
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Members can view own roster members" ON public.team_members
  FOR SELECT TO authenticated
  USING (
    athlete_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.team_members tm2
      WHERE tm2.roster_id = team_members.roster_id
        AND tm2.athlete_user_id = auth.uid()
        AND tm2.status = 'active'
    )
  );

-- Updated_at trigger
CREATE TRIGGER update_team_rosters_updated_at
  BEFORE UPDATE ON public.team_rosters
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
