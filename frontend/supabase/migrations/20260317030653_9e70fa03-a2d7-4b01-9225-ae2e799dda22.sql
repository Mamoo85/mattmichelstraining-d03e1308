
-- Promotions table for admin-created promotions
CREATE TABLE public.promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  description text NOT NULL DEFAULT '',
  discount_type text NOT NULL DEFAULT 'percent' CHECK (discount_type IN ('percent', 'fixed', 'free')),
  discount_value numeric NOT NULL DEFAULT 0,
  applies_to text NOT NULL DEFAULT 'all' CHECK (applies_to IN ('all', 'programs', 'subscriptions')),
  specific_product_id uuid,
  max_uses integer,
  current_uses integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz
);

ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage promotions" ON public.promotions
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone can read active promotions" ON public.promotions
  FOR SELECT TO authenticated
  USING (is_active = true);

-- Gifted products table
CREATE TABLE public.gifted_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  gift_type text NOT NULL DEFAULT 'program' CHECK (gift_type IN ('program', 'subscription', 'promotion')),
  product_id uuid,
  promotion_id uuid REFERENCES public.promotions(id),
  notes text,
  gifted_by uuid NOT NULL,
  gifted_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.gifted_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage gifts" ON public.gifted_products
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view own gifts" ON public.gifted_products
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
