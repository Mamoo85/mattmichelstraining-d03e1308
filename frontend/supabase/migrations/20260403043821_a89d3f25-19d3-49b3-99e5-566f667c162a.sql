
CREATE TABLE public.sport_guides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  sport TEXT NOT NULL DEFAULT 'general',
  price_cents INTEGER NOT NULL DEFAULT 1500,
  sort_order INTEGER NOT NULL DEFAULT 10,
  description TEXT DEFAULT '',
  stripe_price_id TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.sport_guides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active guides"
  ON public.sport_guides FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can do anything with guides"
  ON public.sport_guides FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.purchased_guides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  guide_id UUID NOT NULL REFERENCES public.sport_guides(id),
  purchased_at TIMESTAMPTZ DEFAULT now(),
  stripe_session_id TEXT,
  UNIQUE(user_id, guide_id)
);

ALTER TABLE public.purchased_guides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own purchases"
  ON public.purchased_guides FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Service role can insert purchases"
  ON public.purchased_guides FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can view all purchases"
  ON public.purchased_guides FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
