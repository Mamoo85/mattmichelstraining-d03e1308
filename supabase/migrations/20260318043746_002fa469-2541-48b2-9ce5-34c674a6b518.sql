
-- Drop overly permissive policies
DROP POLICY IF EXISTS "Anyone can read invite by token" ON public.parent_invite_tokens;
DROP POLICY IF EXISTS "Users can update invites they redeem" ON public.parent_invite_tokens;

-- Allow authenticated users to read unused invites (needed for redemption lookup)
CREATE POLICY "Authenticated can read unused invites"
  ON public.parent_invite_tokens
  FOR SELECT
  TO authenticated
  USING (parent_user_id = auth.uid() OR (is_used = false));
