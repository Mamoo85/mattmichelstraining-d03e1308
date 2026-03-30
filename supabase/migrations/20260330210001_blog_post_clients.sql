CREATE TABLE IF NOT EXISTS public.blog_post_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name TEXT NOT NULL,
  contact_name TEXT,
  email TEXT NOT NULL UNIQUE,
  website TEXT,
  industry TEXT,
  tone TEXT DEFAULT 'professional',
  stripe_subscription_id TEXT,
  active BOOLEAN NOT NULL DEFAULT false,
  post_count INT NOT NULL DEFAULT 0,
  last_post_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.blog_post_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages blog_post_clients"
  ON public.blog_post_clients FOR ALL TO service_role USING (true) WITH CHECK (true);
