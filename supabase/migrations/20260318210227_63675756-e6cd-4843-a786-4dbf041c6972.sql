
-- Drop the vulnerable UPDATE policy that allows users to modify any column
DROP POLICY IF EXISTS "Users can toggle own visibility" ON public.user_points;

-- Create a SECURITY DEFINER function for toggling visibility only
CREATE OR REPLACE FUNCTION public.toggle_points_visibility(_is_public boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.user_points
  SET is_public = _is_public
  WHERE user_id = auth.uid();
END;
$$;

-- Re-create a read-own policy (users need to see their own points)
CREATE POLICY "Users can read own points"
  ON public.user_points FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- No UPDATE policy for regular users — all updates go through SECURITY DEFINER functions
-- (award_points RPC for score changes, toggle_points_visibility for visibility)
