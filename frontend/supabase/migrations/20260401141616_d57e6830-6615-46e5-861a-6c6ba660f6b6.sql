
DROP VIEW IF EXISTS public.business_listings_public;
CREATE VIEW public.business_listings_public
WITH (security_invoker = on)
AS
SELECT id, business_name, owner_name, industry, city, state, website, description, logo_url, tier, is_featured, is_active
FROM public.business_listings
WHERE is_active = true;
