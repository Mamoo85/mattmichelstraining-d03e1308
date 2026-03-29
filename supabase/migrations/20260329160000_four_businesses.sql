-- ============================================================
-- FOUR AUTOMATED REVENUE BUSINESSES
-- 1. Contractor Lead Gen
-- 2. B2B Lead Database (Dental)
-- 3. GBP / Local Marketing SaaS
-- 4. Sales Rep Newsletter
-- ============================================================

-- ── BUSINESS 1: CONTRACTOR LEAD GEN ─────────────────────────

CREATE TABLE IF NOT EXISTS contractor_lead_sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade TEXT NOT NULL,        -- 'roofing' | 'hvac' | 'plumbing' | 'electrical' | 'gutters'
  city TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'MI',
  slug TEXT NOT NULL UNIQUE,  -- 'roofing-detroit'
  active_contractor_id UUID,  -- FK to contractor_clients once assigned
  monthly_fee_cents INT NOT NULL DEFAULT 39900,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS contractor_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  business_name TEXT,
  email TEXT NOT NULL,
  phone TEXT,
  trade TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'MI',
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  active BOOLEAN NOT NULL DEFAULT false,
  trial_ends_at TIMESTAMPTZ,
  onboarded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS contractor_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID REFERENCES contractor_lead_sites(id),
  client_id UUID REFERENCES contractor_clients(id),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  message TEXT,
  project_type TEXT,
  notified_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'new', -- 'new' | 'notified' | 'contacted' | 'closed'
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Seed 5 initial lead sites for Metro Detroit
INSERT INTO contractor_lead_sites (trade, city, state, slug, monthly_fee_cents) VALUES
  ('roofing',     'Detroit',     'MI', 'roofing-detroit',     39900),
  ('hvac',        'Detroit',     'MI', 'hvac-detroit',        39900),
  ('plumbing',    'Detroit',     'MI', 'plumbing-detroit',    39900),
  ('electrical',  'Detroit',     'MI', 'electrical-detroit',  39900),
  ('roofing',     'Ann Arbor',   'MI', 'roofing-ann-arbor',   29900)
ON CONFLICT (slug) DO NOTHING;

-- ── BUSINESS 2: B2B LEAD DATABASE ───────────────────────────

CREATE TABLE IF NOT EXISTS b2b_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  industry TEXT NOT NULL DEFAULT 'dental',
  business_name TEXT NOT NULL,
  owner_name TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  google_place_id TEXT UNIQUE,
  rating NUMERIC(3,1),
  review_count INT,
  source TEXT NOT NULL DEFAULT 'google_maps',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS b2b_contacts_industry_state ON b2b_contacts(industry, state);
CREATE INDEX IF NOT EXISTS b2b_contacts_city ON b2b_contacts(city);

CREATE TABLE IF NOT EXISTS b2b_subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  niche TEXT NOT NULL DEFAULT 'dental',
  active BOOLEAN NOT NULL DEFAULT false,
  access_token TEXT DEFAULT gen_random_uuid()::TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── BUSINESS 3: GBP / LOCAL MARKETING SAAS ──────────────────

CREATE TABLE IF NOT EXISTS gbp_saas_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name TEXT NOT NULL,
  business_type TEXT,      -- 'plumber' | 'roofer' | 'dentist' | etc.
  contact_name TEXT,
  email TEXT NOT NULL,
  phone TEXT,
  city TEXT,
  state TEXT,
  gbp_location_id TEXT,    -- Google Business Profile location ID
  gbp_access_token TEXT,   -- OAuth access token
  gbp_refresh_token TEXT,  -- OAuth refresh token
  stripe_subscription_id TEXT,
  plan TEXT NOT NULL DEFAULT 'basic',  -- 'basic' ($49) | 'pro' ($99)
  active BOOLEAN NOT NULL DEFAULT false,
  last_post_at TIMESTAMPTZ,
  post_count INT NOT NULL DEFAULT 0,
  customer_emails TEXT[],  -- emails to send review requests to
  intake_completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── BUSINESS 4: NEWSLETTER ───────────────────────────────────

CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  source TEXT DEFAULT 'website',  -- 'website' | 'b2b_leads' | 'contractor_leads' | 'manual'
  active BOOLEAN NOT NULL DEFAULT true,
  subscribed_at TIMESTAMPTZ DEFAULT now(),
  unsubscribed_at TIMESTAMPTZ,
  unsubscribe_token TEXT DEFAULT gen_random_uuid()::TEXT
);

CREATE TABLE IF NOT EXISTS newsletter_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject TEXT NOT NULL,
  content_html TEXT NOT NULL,
  preview_text TEXT,
  sent_at TIMESTAMPTZ,
  scheduled_for TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'draft',  -- 'draft' | 'approved' | 'sent'
  recipient_count INT,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── CRON JOBS ────────────────────────────────────────────────
-- All jobs call edge functions via the vault-stored service key

DO $$
DECLARE
  service_url TEXT;
  svc_key TEXT;
BEGIN
  SELECT decrypted_secret INTO svc_key
    FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1;
  service_url := current_setting('app.settings.supabase_url', true);
  IF service_url IS NULL THEN
    service_url := 'https://your-project.supabase.co';
  END IF;

  -- B2B dental scraper — daily 6am ET (11am UTC)
  PERFORM cron.schedule(
    'b2b-dental-scraper',
    '0 11 * * *',
    format(
      $q$SELECT extensions.http_post(
        '%s/functions/v1/b2b-dental-scraper',
        '{"Authorization":"Bearer %s","Content-Type":"application/json"}',
        '{}'
      )$q$,
      service_url, svc_key
    )
  );

  -- GBP posting — Mon/Wed/Fri 10am ET (3pm UTC)
  PERFORM cron.schedule(
    'gbp-saas-poster',
    '0 15 * * 1,3,5',
    format(
      $q$SELECT extensions.http_post(
        '%s/functions/v1/gbp-saas-poster',
        '{"Authorization":"Bearer %s","Content-Type":"application/json"}',
        '{}'
      )$q$,
      service_url, svc_key
    )
  );

  -- GBP review requests — every Sunday 9am ET (2pm UTC)
  PERFORM cron.schedule(
    'gbp-review-requester',
    '0 14 * * 0',
    format(
      $q$SELECT extensions.http_post(
        '%s/functions/v1/gbp-review-requester',
        '{"Authorization":"Bearer %s","Content-Type":"application/json"}',
        '{}'
      )$q$,
      service_url, svc_key
    )
  );

  -- Newsletter — every Monday 8am ET (1pm UTC)
  PERFORM cron.schedule(
    'newsletter-weekly',
    '0 13 * * 1',
    format(
      $q$SELECT extensions.http_post(
        '%s/functions/v1/newsletter-send',
        '{"Authorization":"Bearer %s","Content-Type":"application/json"}',
        '{}'
      )$q$,
      service_url, svc_key
    )
  );

  -- Contractor lead notify check — every 15 minutes
  PERFORM cron.schedule(
    'contractor-lead-notify',
    '*/15 * * * *',
    format(
      $q$SELECT extensions.http_post(
        '%s/functions/v1/contractor-lead-notify',
        '{"Authorization":"Bearer %s","Content-Type":"application/json"}',
        '{}'
      )$q$,
      service_url, svc_key
    )
  );

  -- Contractor prospecting — daily 11am ET (4pm UTC)
  PERFORM cron.schedule(
    'contractor-lead-prospect',
    '0 16 * * *',
    format(
      $q$SELECT extensions.http_post(
        '%s/functions/v1/prospect-local-businesses',
        '{"Authorization":"Bearer %s","Content-Type":"application/json"}',
        '{"mode":"contractor_lead_pitch"}'
      )$q$,
      service_url, svc_key
    )
  );

EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Cron scheduling skipped (pg_cron may not be available): %', SQLERRM;
END;
$$;
