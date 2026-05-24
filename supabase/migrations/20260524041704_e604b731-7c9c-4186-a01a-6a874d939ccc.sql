-- Subscription plans catalog (public read)
CREATE TABLE IF NOT EXISTS public.gng_subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  tagline text,
  description text,
  price_cents int NOT NULL,
  currency text NOT NULL DEFAULT 'usd',
  interval text NOT NULL DEFAULT 'month',
  included_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_digital boolean NOT NULL DEFAULT false,
  cover_image_url text,
  active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  stripe_price_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.gng_subscription_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read active gng_subscription_plans" ON public.gng_subscription_plans FOR SELECT TO anon, authenticated USING (active = true);
CREATE POLICY "service role full gng_subscription_plans" ON public.gng_subscription_plans TO service_role USING (true) WITH CHECK (true);

-- Customer subscriptions
CREATE TABLE IF NOT EXISTS public.gng_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_subscription_id text UNIQUE,
  stripe_customer_id text,
  customer_email text NOT NULL,
  customer_name text,
  plan_slug text NOT NULL REFERENCES public.gng_subscription_plans(slug),
  status text NOT NULL DEFAULT 'pending',
  ship_address_line1 text,
  ship_address_line2 text,
  ship_city text,
  ship_state text,
  ship_postal_code text,
  ship_country text DEFAULT 'US',
  current_period_start timestamptz,
  current_period_end timestamptz,
  next_ship_date date,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  cancelled_at timestamptz,
  notes text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gng_subs_email ON public.gng_subscriptions(customer_email);
CREATE INDEX IF NOT EXISTS idx_gng_subs_status ON public.gng_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_gng_subs_next_ship ON public.gng_subscriptions(next_ship_date) WHERE status = 'active';
ALTER TABLE public.gng_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role full gng_subscriptions" ON public.gng_subscriptions TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "admin read gng_subscriptions" ON public.gng_subscriptions FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Per-month shipment log
CREATE TABLE IF NOT EXISTS public.gng_subscription_shipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES public.gng_subscriptions(id) ON DELETE CASCADE,
  plan_slug text NOT NULL,
  period_label text NOT NULL,
  selected_listing_id bigint,
  selected_sku text,
  status text NOT NULL DEFAULT 'pending',
  tracking_carrier text,
  tracking_number text,
  shipped_at timestamptz,
  delivered_at timestamptz,
  download_url text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (subscription_id, period_label)
);
CREATE INDEX IF NOT EXISTS idx_gng_shipments_status ON public.gng_subscription_shipments(status, created_at DESC);
ALTER TABLE public.gng_subscription_shipments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role full gng_shipments" ON public.gng_subscription_shipments TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "admin read gng_shipments" ON public.gng_subscription_shipments FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Seed 4 default plans
INSERT INTO public.gng_subscription_plans (slug, name, tagline, description, price_cents, is_digital, sort_order, included_items)
VALUES
  ('sock-of-the-month', 'Sock of the Month', 'One cozy pair, hand-picked monthly.', 'Every month we ship a fresh pair of premium cozy socks — curated from our handmade and small-batch collection. Cancel anytime.', 2400, false, 1,
   '[{"label":"1 premium sock pair"},{"label":"Surprise pattern + color"},{"label":"Free shipping in US"},{"label":"Cancel anytime"}]'::jsonb),
  ('yarn-of-the-month', 'Yarn of the Month', 'A new skein + mini pattern, monthly.', 'A surprise hand-curated skein paired with a mini knitting/crochet pattern. Perfect for makers who want fresh inspiration each month.', 2900, false, 2,
   '[{"label":"1 curated skein"},{"label":"Exclusive mini pattern"},{"label":"Free shipping in US"},{"label":"Cancel anytime"}]'::jsonb),
  ('pattern-of-the-month', 'Pattern of the Month', 'Fresh digital pattern in your inbox.', 'A new premium knitting/crochet pattern PDF delivered to your inbox every month. Instant access, lifetime to your library.', 500, true, 3,
   '[{"label":"Premium PDF pattern"},{"label":"Instant email delivery"},{"label":"Lifetime access"},{"label":"Cancel anytime"}]'::jsonb),
  ('gift-of-the-month', 'Gift of the Month', 'A surprise from the shop, monthly.', 'Let us send you (or a loved one) a surprise gift from the shop every month. Hand-curated, beautifully packed.', 3900, false, 4,
   '[{"label":"1 surprise gift item"},{"label":"Hand-wrapped + note"},{"label":"Free shipping in US"},{"label":"Cancel anytime"}]'::jsonb)
ON CONFLICT (slug) DO NOTHING;