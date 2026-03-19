
-- Drop the permissive UPDATE policy
DROP POLICY "Users can update their own profile" ON public.profiles;

-- Re-create with WITH CHECK to ensure users can only update their own row
CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
