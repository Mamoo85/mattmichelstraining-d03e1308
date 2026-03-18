-- Fix: Drop the overly permissive INSERT policy that allows any authenticated user
-- to self-enroll in paid programs without payment verification.
-- The existing service_role INSERT policy handles legitimate enrollments from edge functions.
DROP POLICY IF EXISTS "Users can insert own active programs" ON public.user_active_programs;