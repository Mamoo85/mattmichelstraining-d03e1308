CREATE TABLE IF NOT EXISTS public.weekly_digest_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name TEXT NOT NULL,
  contact_name TEXT,
  email TEXT NOT NULL UNIQUE,
  industry TEXT,
  stripe_subscription_id TEXT,
  active BOOLEAN NOT NULL DEFAULT false,
  digest_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.weekly_digest_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages weekly_digest_clients"
  ON public.weekly_digest_clients FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Every Monday 8am ET (12:00 UTC)
SELECT cron.schedule(
  'ai-weekly-digest-monday',
  '0 12 * * 1',
  $$
  SELECT net.http_post(
    url := 'https://zmyczlfuufhngzovkjdh.supabase.co/functions/v1/ai-weekly-digest-sender',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer service_role"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
