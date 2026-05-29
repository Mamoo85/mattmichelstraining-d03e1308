
-- Fix 1: profiles - Drop legacy {public} role policies and re-create as {authenticated}
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;

-- Re-create admin update policy scoped to authenticated
CREATE POLICY "Admins can update all profiles"
  ON public.profiles FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Re-create insert policy scoped to authenticated
CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Fix 2: transactions - Make the null user_id block truly RESTRICTIVE
DROP POLICY IF EXISTS "Block null user_id transactions for regular users" ON public.transactions;

CREATE POLICY "Block null user_id transactions for regular users"
  ON public.transactions AS RESTRICTIVE FOR SELECT TO authenticated
  USING (
    (user_id IS NOT NULL AND auth.uid() = user_id)
    OR has_role(auth.uid(), 'admin'::app_role)
  );
