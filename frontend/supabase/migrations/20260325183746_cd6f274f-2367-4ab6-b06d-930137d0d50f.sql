
-- 1. Promotions: add restrictive SELECT so users can only look up active, non-expired codes (not scan the full table)
CREATE POLICY "Users can validate active promo codes"
ON public.promotions
FOR SELECT
TO authenticated
USING (
  is_active = true
  AND (expires_at IS NULL OR expires_at > now())
  AND (max_uses IS NULL OR current_uses < max_uses)
);

-- 2. Service catalog: replace the overly permissive public read with one that filters to active items only
DROP POLICY IF EXISTS "Anyone can read active catalog" ON public.service_catalog;

CREATE POLICY "Anyone can read active catalog"
ON public.service_catalog
FOR SELECT
TO public
USING (is_active = true);
