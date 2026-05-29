
-- Security definer function to check if user is a team member
CREATE OR REPLACE FUNCTION public.is_active_team_member(_user_id uuid, _roster_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE roster_id = _roster_id
      AND athlete_user_id = _user_id
      AND status = 'active'
  )
$$;

-- Security definer function to check if user owns the roster
CREATE OR REPLACE FUNCTION public.is_roster_owner(_user_id uuid, _roster_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_rosters
    WHERE id = _roster_id AND owner_id = _user_id
  )
$$;

-- Fix team_rosters: replace the recursive policy
DROP POLICY IF EXISTS "Team members can view their roster" ON public.team_rosters;
CREATE POLICY "Team members can view their roster" ON public.team_rosters
  FOR SELECT TO authenticated
  USING (public.is_active_team_member(auth.uid(), id));

-- Fix team_members: replace recursive policies
DROP POLICY IF EXISTS "Owners and admins can view roster members" ON public.team_members;
CREATE POLICY "Owners and admins can view roster members" ON public.team_members
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR public.is_roster_owner(auth.uid(), roster_id)
  );

DROP POLICY IF EXISTS "Roster owners can manage members" ON public.team_members;
CREATE POLICY "Roster owners can manage members" ON public.team_members
  FOR ALL TO authenticated
  USING (public.is_roster_owner(auth.uid(), roster_id))
  WITH CHECK (public.is_roster_owner(auth.uid(), roster_id));
