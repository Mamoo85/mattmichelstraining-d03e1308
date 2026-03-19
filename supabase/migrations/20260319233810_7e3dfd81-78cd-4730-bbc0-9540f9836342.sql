
-- Fix 1: parent_child_links - Remove the permissive INSERT policy that allows any user to link to any athlete.
-- Links should only be created via edge functions (service role).
DROP POLICY IF EXISTS "Parents can link only to child accounts" ON parent_child_links;

-- Allow children to delete links targeting their own account (consent revocation)
CREATE POLICY "Children can remove own links"
  ON parent_child_links FOR DELETE TO authenticated
  USING (auth.uid() = child_user_id);

-- Fix 2: profiles - Add WITH CHECK to prevent users from modifying sensitive fields.
-- The existing trigger is a backup, but RLS should be the first line of defense.
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND subscription_tier = (SELECT p.subscription_tier FROM profiles p WHERE p.user_id = auth.uid())
    AND is_pro = (SELECT p.is_pro FROM profiles p WHERE p.user_id = auth.uid())
    AND account_role = (SELECT p.account_role FROM profiles p WHERE p.user_id = auth.uid())
    AND stripe_customer_id IS NOT DISTINCT FROM (SELECT p.stripe_customer_id FROM profiles p WHERE p.user_id = auth.uid())
    AND is_vip = (SELECT p.is_vip FROM profiles p WHERE p.user_id = auth.uid())
  );
