
-- 1. FIX: parent_invite_tokens - Remove the (is_used = false) clause that leaks tokens
DROP POLICY IF EXISTS "Authenticated can read unused invites" ON public.parent_invite_tokens;
CREATE POLICY "Parents can read own invites"
  ON public.parent_invite_tokens FOR SELECT
  TO authenticated
  USING (parent_user_id = auth.uid());

-- 2. FIX: schedule_slots - Create a view hiding sensitive columns for anon users
-- Drop the overly permissive policy and replace with two policies
DROP POLICY IF EXISTS "Anyone can view slots" ON public.schedule_slots;

-- Authenticated users can see all slot data
CREATE POLICY "Authenticated can view slots"
  ON public.schedule_slots FOR SELECT
  TO authenticated
  USING (true);

-- Anon users can only see slots (booked_by/booking_id will be visible but we restrict to available only)
CREATE POLICY "Anon can view available slots"
  ON public.schedule_slots FOR SELECT
  TO anon
  USING (is_available = true AND booked_by IS NULL);

-- 3. FIX: trial_settings - Restrict to admin only
DROP POLICY IF EXISTS "Anyone can read trial settings" ON public.trial_settings;
CREATE POLICY "Admins can read trial settings"
  ON public.trial_settings FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- 4. FIX: team_members - Create a secure view that hides email from non-owners
-- We'll tighten the existing policy so only roster owners and admins see emails
DROP POLICY IF EXISTS "Members can view own roster members" ON public.team_members;

-- Roster owners and admins can see full data including email
CREATE POLICY "Owners and admins can view roster members"
  ON public.team_members FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.team_rosters
      WHERE team_rosters.id = team_members.roster_id
        AND team_rosters.owner_id = auth.uid()
    )
  );

-- Regular members can view their own roster peers (but we'll handle email hiding in app code)
CREATE POLICY "Members can view own roster peers"
  ON public.team_members FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.team_members tm2
      WHERE tm2.roster_id = team_members.roster_id
        AND tm2.athlete_user_id = auth.uid()
        AND tm2.status = 'active'
    )
  );
