CREATE TABLE IF NOT EXISTS public.website_copy_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name TEXT NOT NULL,
  contact_name TEXT,
  email TEXT NOT NULL UNIQUE,
  website TEXT,
  industry TEXT,
  city TEXT,
  stripe_subscription_id TEXT,
  active BOOLEAN NOT NULL DEFAULT false,
  refresh_count INT NOT NULL DEFAULT 0,
  last_refreshed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.website_copy_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages website_copy_clients"
  ON public.website_copy_clients FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 1st of month 10am ET (14:00 UTC)
SELECT cron.schedule(
  'ai-website-copy-monthly',
  '0 14 1 * *',
  $$
  SELECT net.http_post(
    url := 'https://zmyczlfuufhngzovkjdh.supabase.co/functions/v1/ai-website-copy-refresher',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer service_role"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
