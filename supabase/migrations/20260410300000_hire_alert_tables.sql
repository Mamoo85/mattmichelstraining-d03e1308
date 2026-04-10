-- TechAlert Hiring Monitor — hire_alert_clients, hire_alert_candidates, hire_alert_runs
-- Scanner cron: daily 7am ET (0 12 * * *)

CREATE TABLE IF NOT EXISTS hire_alert_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL,
  owner_email text NOT NULL,
  owner_phone text,
  stripe_customer_id text,
  stripe_subscription_id text,
  active boolean NOT NULL DEFAULT true,
  plan text NOT NULL DEFAULT 'standalone', -- 'bundle' | 'standalone'
  target_roles text[] NOT NULL DEFAULT ARRAY['boiler_operator', 'hvac_tech'],
  target_zip_codes text[] NOT NULL DEFAULT ARRAY[]::text[],
  notify_email boolean NOT NULL DEFAULT true,
  notify_sms boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE hire_alert_clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_hire_alert_clients"
  ON hire_alert_clients FOR ALL
  TO service_role USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------

CREATE TABLE IF NOT EXISTS hire_alert_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  phone text,
  email text,
  license_type text,
  license_number text UNIQUE,
  license_state text DEFAULT 'MI',
  license_expiry date,
  city text,
  zip text,
  source text NOT NULL, -- 'miosha' | 'apollo' | 'firecrawl'
  status text NOT NULL DEFAULT 'new', -- 'new' | 'alerted' | 'hired' | 'inactive'
  availability_score integer, -- 1-10 from Claude Haiku
  score_reason text,
  raw_data jsonb,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE hire_alert_candidates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_hire_alert_candidates"
  ON hire_alert_candidates FOR ALL
  TO service_role USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------

CREATE TABLE IF NOT EXISTS hire_alert_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_at timestamptz NOT NULL DEFAULT now(),
  source text, -- 'miosha' | 'apollo' | 'firecrawl' | 'all'
  candidates_found integer NOT NULL DEFAULT 0,
  new_candidates integer NOT NULL DEFAULT 0,
  alerts_sent integer NOT NULL DEFAULT 0,
  errors jsonb
);

ALTER TABLE hire_alert_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_hire_alert_runs"
  ON hire_alert_runs FOR ALL
  TO service_role USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------
-- Cron: daily 7am ET = 12:00 UTC
-- ---------------------------------------------------------------
SELECT cron.schedule(
  'hire-alert-scanner-daily',
  '0 12 * * *',
  $$
    SELECT net.http_post(
      url := current_setting('app.supabase_url') || '/functions/v1/hire-alert-scanner',
      headers := '{"Content-Type":"application/json","Authorization":"Bearer " || current_setting(''app.service_role_key'')}'::jsonb,
      body := '{}'::jsonb
    );
  $$
);
