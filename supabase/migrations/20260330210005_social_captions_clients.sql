CREATE TABLE IF NOT EXISTS public.social_captions_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name TEXT NOT NULL,
  contact_name TEXT,
  email TEXT NOT NULL UNIQUE,
  industry TEXT,
  platforms TEXT DEFAULT 'Facebook, Instagram, LinkedIn',
  stripe_subscription_id TEXT,
  active BOOLEAN NOT NULL DEFAULT false,
  pack_count INT NOT NULL DEFAULT 0,
  last_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.social_captions_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages social_captions_clients"
  ON public.social_captions_clients FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 1st of month 9am ET (13:00 UTC)
SELECT cron.schedule(
  'ai-social-captions-monthly',
  '0 13 1 * *',
  $$
  SELECT net.http_post(
    url := 'https://zmyczlfuufhngzovkjdh.supabase.co/functions/v1/ai-social-captions-generator',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer service_role"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
