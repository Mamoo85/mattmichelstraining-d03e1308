
-- Fix 1: Recreate views with SECURITY INVOKER to respect RLS

-- Drop and recreate business_listings_public
DROP VIEW IF EXISTS public.business_listings_public;
CREATE VIEW public.business_listings_public
WITH (security_invoker = true)
AS SELECT id, business_name, city, state, industry, description, logo_url, website, tier, is_featured, is_active, created_at, updated_at
FROM public.business_listings
WHERE is_active = true;

-- Drop and recreate generated_sites_public
DROP VIEW IF EXISTS public.generated_sites_public;
CREATE VIEW public.generated_sites_public
WITH (security_invoker = true)
AS SELECT id, business_name, slug, template_key, color_scheme, sections, is_published, published_at, created_at, updated_at
FROM public.generated_sites
WHERE is_published = true;

-- Drop and recreate training_programs_public
DROP VIEW IF EXISTS public.training_programs_public;
CREATE VIEW public.training_programs_public
WITH (security_invoker = true)
AS SELECT id, title, description, category, level, sport, price, total_weeks, is_active, created_at
FROM public.training_programs
WHERE is_active = true;

-- Grant SELECT to anon and authenticated so public pages work
GRANT SELECT ON public.business_listings_public TO anon, authenticated;
GRANT SELECT ON public.generated_sites_public TO anon, authenticated;
GRANT SELECT ON public.training_programs_public TO anon, authenticated;

-- Add public SELECT RLS policies on underlying tables for anon/authenticated to read active/published rows
-- business_listings: allow anon to read active listings
CREATE POLICY "Public can view active listings"
  ON public.business_listings FOR SELECT TO anon, authenticated
  USING (is_active = true);

-- generated_sites: allow anon to read published sites
CREATE POLICY "Public can view published sites"
  ON public.generated_sites FOR SELECT TO anon, authenticated
  USING (is_published = true);

-- training_programs already has get_active_training_programs() SECURITY DEFINER function
-- Add a public SELECT policy for active programs
CREATE POLICY "Public can view active programs"
  ON public.training_programs FOR SELECT TO anon, authenticated
  USING (is_active = true);


-- Fix 2: Create a security-definer function for users to view their own ai_action_queue items without admin_notes/context
CREATE OR REPLACE FUNCTION public.get_my_pending_actions()
RETURNS TABLE(id uuid, action_type text, status text, ai_result text, created_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT id, action_type, status, ai_result, created_at
  FROM public.ai_action_queue
  WHERE target_user_id = auth.uid()
    AND status = 'pending';
$$;

-- Drop the overly permissive user SELECT policy on ai_action_queue
DROP POLICY IF EXISTS "Users can view own pending actions" ON public.ai_action_queue;
