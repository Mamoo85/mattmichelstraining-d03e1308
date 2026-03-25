
-- Drop the vulnerable policy that allows NULL user_id rows to slip through
DROP POLICY IF EXISTS "Users can view own transactions" ON public.transactions;

-- Recreate with explicit NULL protection
CREATE POLICY "Users can view own transactions"
ON public.transactions
FOR SELECT
TO authenticated
USING (user_id IS NOT NULL AND auth.uid() = user_id);
