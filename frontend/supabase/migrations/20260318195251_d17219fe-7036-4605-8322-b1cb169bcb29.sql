
-- FIX 1: Remove user-facing INSERT on point_transactions (points should only be awarded via service role / award_points RPC)
DROP POLICY IF EXISTS "Users can insert own transactions" ON public.point_transactions;

-- FIX 2: Restrict gifted session claims to the intended receiver by matching email
DROP POLICY IF EXISTS "Users can claim gifted sessions" ON public.gifted_sessions;
CREATE POLICY "Users can claim gifted sessions"
  ON public.gifted_sessions FOR UPDATE
  TO authenticated
  USING (
    status = 'pending'
    AND claimed_by IS NULL
    AND receiver_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  )
  WITH CHECK (
    claimed_by = auth.uid()
    AND status = 'claimed'
  );

-- FIX 3: Restrict promotions SELECT to only return the fields needed for validation (remove public read of codes)
DROP POLICY IF EXISTS "Anyone can read active promotions" ON public.promotions;
-- No public SELECT policy; promo validation happens server-side in edge functions via service role
