
-- Fix 1: Add RESTRICTIVE policy on transactions to block rows with NULL user_id from non-admin users
-- This ensures no authenticated user can accidentally access orphaned transaction rows
CREATE POLICY "Block null user_id transactions for regular users"
  ON public.transactions
  AS RESTRICTIVE
  FOR SELECT
  TO authenticated
  USING (
    user_id IS NOT NULL OR has_role(auth.uid(), 'admin'::app_role)
  );

-- Fix 2: Drop the redundant/overlapping SELECT policy on team_members
-- "Roster owners can view all members" duplicates "Owners and admins can view roster members"
DROP POLICY IF EXISTS "Roster owners can view all members" ON public.team_members;
