-- Digital products catalog
CREATE TABLE IF NOT EXISTS public.gng_digital_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  tagline text,
  description text,
  price_cents int NOT NULL,
  currency text NOT NULL DEFAULT 'usd',
  file_url text,
  preview_image_url text,
  category text,
  active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.gng_digital_products ENABLE ROW LEVEL SECURITY;
-- Public sees catalog metadata, but file_url is sensitive. Expose only safe columns via a view.
CREATE OR REPLACE VIEW public.gng_digital_products_public
WITH (security_invoker = true)
AS SELECT id, slug, name, tagline, description, price_cents, currency, preview_image_url, category, sort_order
FROM public.gng_digital_products WHERE active = true;
GRANT SELECT ON public.gng_digital_products_public TO anon, authenticated;
CREATE POLICY "service role full gng_digital_products" ON public.gng_digital_products TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "admin read gng_digital_products" ON public.gng_digital_products FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
-- Allow underlying SELECT for the security-invoker view (filtered to active only)
CREATE POLICY "public read active gng_digital_products" ON public.gng_digital_products FOR SELECT TO anon, authenticated USING (active = true);

-- Digital purchases log
CREATE TABLE IF NOT EXISTS public.gng_digital_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_session_id text UNIQUE,
  customer_email text NOT NULL,
  product_slug text NOT NULL REFERENCES public.gng_digital_products(slug),
  amount_paid_cents int NOT NULL,
  download_token text UNIQUE NOT NULL DEFAULT replace(gen_random_uuid()::text, '-', ''),
  download_count int NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '90 days'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gng_dp_email ON public.gng_digital_purchases(customer_email);
ALTER TABLE public.gng_digital_purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role full gng_digital_purchases" ON public.gng_digital_purchases TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "admin read gng_digital_purchases" ON public.gng_digital_purchases FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Loyalty points ledger
CREATE TABLE IF NOT EXISTS public.gng_loyalty_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_email text NOT NULL,
  delta int NOT NULL,
  reason text NOT NULL,
  reference_id text,
  balance_after int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gng_loyalty_email ON public.gng_loyalty_points(customer_email, created_at DESC);
ALTER TABLE public.gng_loyalty_points ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role full gng_loyalty" ON public.gng_loyalty_points TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "admin read gng_loyalty" ON public.gng_loyalty_points FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- SEO audience landing pages
CREATE TABLE IF NOT EXISTS public.gng_seo_audiences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  headline text NOT NULL,
  sub_headline text,
  intro text,
  tag_filters text[] NOT NULL DEFAULT '{}',
  meta_title text,
  meta_description text,
  hero_emoji text,
  active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.gng_seo_audiences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read active gng_seo_audiences" ON public.gng_seo_audiences FOR SELECT TO anon, authenticated USING (active = true);
CREATE POLICY "service role full gng_seo_audiences" ON public.gng_seo_audiences TO service_role USING (true) WITH CHECK (true);

INSERT INTO public.gng_seo_audiences (slug, headline, sub_headline, intro, tag_filters, meta_title, meta_description, hero_emoji, sort_order) VALUES
  ('mom',     'Handmade gifts for Mom',       'Cozy, thoughtful, and made with love.', 'Soft socks, hand-knit scarves, and warm little luxuries Mom will actually use. Hand-curated by Lisa.', ARRAY['mom','mother','mothers day','gift for her'], 'Handmade Gifts for Mom · Guilds & Grains', 'Hand-knit and handmade gifts for moms — cozy socks, scarves, and keepsakes shipped fast.', '💐', 1),
  ('dad',     'Handmade gifts for Dad',       'Useful, rugged, and made to last.',     'Hand-knit warmers, sturdy gifts, and small luxuries Dad will reach for again and again.', ARRAY['dad','father','fathers day','gift for him','men'], 'Handmade Gifts for Dad · Guilds & Grains', 'Hand-knit and handmade gifts for dads — warm socks, hats, and rugged keepsakes.', '🧔', 2),
  ('nurses',  'Cozy gifts for nurses',        'For the people who never sit down.',    'Compression-friendly socks, soft scarves, and small thank-you gifts for the nurses in your life.', ARRAY['nurse','nurses','healthcare','thank you'], 'Gifts for Nurses · Guilds & Grains', 'Hand-knit cozy socks and thank-you gifts for nurses and healthcare workers.', '🩺', 3),
  ('teachers','Thank-you gifts for teachers', 'A little warmth for the ones who give it all year.', 'Hand-knit warmers and small luxe gifts that say thank you better than a card.', ARRAY['teacher','teachers','thank you','appreciation'], 'Gifts for Teachers · Guilds & Grains', 'Handmade thank-you gifts for teachers — cozy, thoughtful, and made to last.', '🍎', 4),
  ('knitters','Gifts for knitters & makers',  'For the people who make.',              'Curated skeins, patterns, and small tools for the makers in your life.', ARRAY['knit','knitter','yarn','crochet','maker','pattern'], 'Gifts for Knitters & Makers · Guilds & Grains', 'Curated yarn, patterns, and tools for knitters and crocheters.', '🧶', 5),
  ('hostess', 'Hostess & housewarming gifts', 'Small luxuries for a warm home.',       'Hand-knit dishcloths, cozy throws, and small things that make a house feel like home.', ARRAY['home','housewarming','hostess','kitchen','decor'], 'Hostess & Housewarming Gifts · Guilds & Grains', 'Handmade hostess and housewarming gifts — kitchen, home, and cozy decor.', '🏡', 6)
ON CONFLICT (slug) DO NOTHING;