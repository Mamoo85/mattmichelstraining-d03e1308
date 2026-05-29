
CREATE TABLE public.instagram_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  image_url TEXT NOT NULL,
  caption TEXT,
  post_url TEXT NOT NULL,
  likes_count INTEGER DEFAULT 0,
  posted_at TIMESTAMPTZ DEFAULT now(),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.instagram_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read active posts" ON public.instagram_posts FOR SELECT USING (active = true);
CREATE POLICY "Admins full access instagram_posts" ON public.instagram_posts FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.content_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type TEXT NOT NULL,
  caption TEXT NOT NULL,
  hashtags TEXT,
  status TEXT DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.content_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins full access content_queue" ON public.content_queue FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
