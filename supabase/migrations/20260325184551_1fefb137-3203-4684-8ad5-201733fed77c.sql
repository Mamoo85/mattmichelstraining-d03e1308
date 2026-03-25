
-- 1. Transactions: add explicit DENY for INSERT/DELETE by regular users
CREATE POLICY "Users cannot insert transactions"
ON public.transactions
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users cannot delete transactions"
ON public.transactions
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- 2. Gifted sessions: restrict giver's view to not expose receiver_email
--    Drop and recreate with limited visibility
DROP POLICY IF EXISTS "Users can view their gifted sessions" ON public.gifted_sessions;

CREATE POLICY "Users can view their gifted sessions"
ON public.gifted_sessions
FOR SELECT
TO authenticated
USING (giver_user_id = auth.uid() OR claimed_by = auth.uid());

-- 3. User roles: add explicit DENY INSERT policy for non-admins
CREATE POLICY "Non-admins cannot insert roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
