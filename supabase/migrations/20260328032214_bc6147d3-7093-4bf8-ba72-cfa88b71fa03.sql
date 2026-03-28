
-- Create a Security Definer function to validate a promo code by requiring the code to be supplied
CREATE OR REPLACE FUNCTION public.validate_promo_code(_code text)
RETURNS TABLE(
  id uuid,
  code text,
  discount_type text,
  discount_value numeric,
  applies_to text,
  specific_product_id uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT p.id, p.code, p.discount_type, p.discount_value, p.applies_to, p.specific_product_id
  FROM public.promotions p
  WHERE p.code = UPPER(TRIM(_code))
    AND p.is_active = true
    AND (p.expires_at IS NULL OR p.expires_at > now())
    AND (p.max_uses IS NULL OR p.current_uses < p.max_uses)
  LIMIT 1;
$$;

-- Drop the permissive SELECT policy that exposes all active promo codes
DROP POLICY IF EXISTS "Users can validate active promo codes" ON public.promotions;
