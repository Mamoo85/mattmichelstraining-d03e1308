
-- ============================================
-- CMS TABLES: products, testimonials, announcement_banner
-- ============================================

-- 1. PRODUCTS table for Shop & Merch
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  product_type text NOT NULL DEFAULT 'digital',
  price numeric NOT NULL DEFAULT 0,
  description text NOT NULL DEFAULT '',
  image_url text,
  external_url text,
  category text NOT NULL DEFAULT 'general',
  is_live boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read live products"
  ON public.products FOR SELECT TO anon, authenticated
  USING (is_live = true);

CREATE POLICY "Admins can manage all products"
  ON public.products FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 2. TESTIMONIALS table
CREATE TABLE public.testimonials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote text NOT NULL,
  author_name text NOT NULL,
  author_role text NOT NULL DEFAULT '',
  author_initials text NOT NULL DEFAULT '',
  sport text,
  page text NOT NULL DEFAULT 'home',
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active testimonials"
  ON public.testimonials FOR SELECT TO anon, authenticated
  USING (is_active = true);

CREATE POLICY "Admins can manage all testimonials"
  ON public.testimonials FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 3. Seed site_content for announcement banner + homepage stats
INSERT INTO public.site_content (section, content_key, content_type, content_value, label, sort_order)
VALUES
  ('announcement', 'banner_text', 'text', 'Winter Registration Now Open!', 'Banner Text', 1),
  ('announcement', 'banner_enabled', 'toggle', 'false', 'Banner Enabled', 2),
  ('homepage_stats', 'stat_1_value', 'text', '50+', 'Stat 1 Value', 1),
  ('homepage_stats', 'stat_1_label', 'text', 'College Athletes', 'Stat 1 Label', 2),
  ('homepage_stats', 'stat_2_value', 'text', '20+', 'Stat 2 Value', 3),
  ('homepage_stats', 'stat_2_label', 'text', 'Years Experience', 'Stat 2 Label', 4),
  ('homepage_stats', 'stat_3_value', 'text', '1000s', 'Stat 3 Value', 5),
  ('homepage_stats', 'stat_3_label', 'text', 'Clients Coached', 'Stat 3 Label', 6),
  ('homepage_stats', 'stat_4_value', 'text', 'Zero', 'Stat 4 Value', 7),
  ('homepage_stats', 'stat_4_label', 'text', 'Injuries — Ever', 'Stat 4 Label', 8)
ON CONFLICT DO NOTHING;

-- Updated_at trigger for new tables
CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_testimonials_updated_at
  BEFORE UPDATE ON public.testimonials
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
