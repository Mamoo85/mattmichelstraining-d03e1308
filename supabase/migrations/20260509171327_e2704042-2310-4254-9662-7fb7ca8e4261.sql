-- 1. Beta tier + trial expiry on counsel_search_clients
ALTER TABLE public.counsel_search_clients 
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS invited_by_admin uuid,
  ADD COLUMN IF NOT EXISTS invite_note text;

-- 2. Citation columns on counsel_searches
ALTER TABLE public.counsel_searches
  ADD COLUMN IF NOT EXISTS citations jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS verification_failed jsonb DEFAULT '[]'::jsonb;

-- 3. Prospects table for cold outreach
CREATE TABLE IF NOT EXISTS public.counsel_search_prospects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE,
  full_name text,
  firm_name text,
  bar_number text,
  practice_area text,
  city text,
  state text DEFAULT 'MI',
  source text,
  website text,
  owner_phone text,
  enriched_at timestamptz,
  cold_emailed_at timestamptz,
  followup_d3_sent_at timestamptz,
  followup_d7_sent_at timestamptz,
  followup_d14_sent_at timestamptz,
  replied_at timestamptz,
  reply_positive boolean,
  converted_at timestamptz,
  blocked boolean DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_counsel_prospects_outreach 
  ON public.counsel_search_prospects (cold_emailed_at, blocked, enriched_at);
CREATE INDEX IF NOT EXISTS idx_counsel_prospects_followup 
  ON public.counsel_search_prospects (cold_emailed_at, followup_d3_sent_at, followup_d7_sent_at);

ALTER TABLE public.counsel_search_prospects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_counsel_prospects" ON public.counsel_search_prospects
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "admin_read_counsel_prospects" ON public.counsel_search_prospects
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 4. Cron jobs for outreach pipeline (using verified vault key pattern)
SELECT cron.schedule(
  'counsel-prospect-hunter-daily',
  '0 11 * * *',  -- 6am ET (11:00 UTC)
  $$
  SELECT net.http_post(
    url := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/counsel-prospect-hunter',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY_VAULT')
    ),
    body := '{}'::jsonb
  );
  $$
);

SELECT cron.schedule(
  'counsel-prospect-enrich-daily',
  '0 12 * * *',  -- 7am ET
  $$
  SELECT net.http_post(
    url := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/counsel-prospect-enrich',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY_VAULT')
    ),
    body := '{}'::jsonb
  );
  $$
);

SELECT cron.schedule(
  'counsel-cold-outreach-daily',
  '0 13 * * *',  -- 8am ET
  $$
  SELECT net.http_post(
    url := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/counsel-cold-outreach',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY_VAULT')
    ),
    body := '{}'::jsonb
  );
  $$
);

SELECT cron.schedule(
  'counsel-followup-drip-am',
  '0 14 * * *',  -- 9am ET
  $$
  SELECT net.http_post(
    url := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/counsel-followup-drip',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY_VAULT')
    ),
    body := '{}'::jsonb
  );
  $$
);

SELECT cron.schedule(
  'counsel-followup-drip-pm',
  '0 19 * * *',  -- 2pm ET
  $$
  SELECT net.http_post(
    url := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/counsel-followup-drip',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY_VAULT')
    ),
    body := '{}'::jsonb
  );
  $$
);