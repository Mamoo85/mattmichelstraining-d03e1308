-- Fix parent_child_links: only allow linking to users with 'athlete' account_role (child accounts)
-- Drop the existing overly permissive INSERT policy
DROP POLICY IF EXISTS "Parents can create links" ON public.parent_child_links;
DROP POLICY IF EXISTS "Parents can insert links" ON public.parent_child_links;

-- Create a restrictive INSERT policy that requires the child to have account_role = 'athlete'
CREATE POLICY "Parents can link only to child accounts"
ON public.parent_child_links
FOR INSERT
TO authenticated
WITH CHECK (
  parent_user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = child_user_id
    AND p.account_role = 'athlete'
  )
);