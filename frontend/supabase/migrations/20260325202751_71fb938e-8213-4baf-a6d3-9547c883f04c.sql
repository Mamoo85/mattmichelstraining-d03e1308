
-- Fix: make the view use SECURITY INVOKER so RLS on profiles still applies
ALTER VIEW public.profiles_safe SET (security_invoker = on);
