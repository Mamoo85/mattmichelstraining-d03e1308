
-- ============================================
-- STRICT RLS HARDENING MIGRATION
-- ============================================

-- 1. SUBSCRIPTIONS: Add admin override + service role
CREATE POLICY "Admins can manage all subscriptions"
  ON public.subscriptions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role manages subscriptions"
  ON public.subscriptions FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- 2. USER_ROLES: Add admin management (INSERT/UPDATE/DELETE)
CREATE POLICY "Admins can manage all roles"
  ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 3. USER_ACTIVE_PROGRAMS: Add user UPDATE for own rows
CREATE POLICY "Users can update own active programs"
  ON public.user_active_programs FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- 4. SESSION_BOOKINGS: Add user INSERT for own bookings
CREATE POLICY "Users can insert own bookings"
  ON public.session_bookings FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 5. WORKOUT_LOGS: Add admin DELETE (currently missing)
CREATE POLICY "Admins can delete all logs"
  ON public.workout_logs FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 6. PURCHASED_PROGRAMS: Add admin DELETE
CREATE POLICY "Admins can delete purchased programs"
  ON public.purchased_programs FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 7. NEWSLETTER_SUBSCRIBERS: Tighten — drop anon INSERT, keep authenticated-only
DROP POLICY IF EXISTS "Anyone can subscribe" ON public.newsletter_subscribers;

-- 8. LEARN_ARTICLES: Ensure no non-admin can write (already correct but enforce)
-- Already has admin ALL + public SELECT for published — ✓

-- 9. EXERCISE_LIBRARY: Already has admin-only write + public read — ✓

-- 10. PROTOCOL_EXERCISES: Add admin management
CREATE POLICY "Admins can manage all protocol exercises"
  ON public.protocol_exercises FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 11. PROTOCOL_EXERCISES: Add user DELETE for own protocols
CREATE POLICY "Users can delete exercises for their protocols"
  ON public.protocol_exercises FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM protocols
    WHERE protocols.id = protocol_exercises.protocol_id
    AND protocols.user_id = auth.uid()
  ));

-- 12. PROTOCOLS: Add admin DELETE + user DELETE
CREATE POLICY "Admins can delete protocols"
  ON public.protocols FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can delete their own protocols"
  ON public.protocols FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- 13. PARENT_INVITE_TOKENS: Add admin management + service role update
CREATE POLICY "Admins can manage invite tokens"
  ON public.parent_invite_tokens FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role can update invite tokens"
  ON public.parent_invite_tokens FOR UPDATE TO service_role
  USING (true) WITH CHECK (true);
