-- SEO Package Orders
CREATE TABLE IF NOT EXISTS seo_package_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_session_id TEXT UNIQUE,
  customer_email TEXT,
  business_name TEXT,
  city TEXT,
  industry TEXT,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit Report Orders
CREATE TABLE IF NOT EXISTS audit_report_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_session_id TEXT UNIQUE,
  customer_email TEXT,
  business_name TEXT,
  city TEXT,
  website_url TEXT,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- GBP Management Clients
CREATE TABLE IF NOT EXISTS gbp_management_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_email TEXT,
  business_name TEXT,
  contact_name TEXT,
  phone TEXT,
  current_gbp_url TEXT,
  stripe_subscription_id TEXT UNIQUE,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Camp Directory Listings
CREATE TABLE IF NOT EXISTS camp_directory_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  camp_name TEXT NOT NULL,
  sport TEXT,
  age_range TEXT,
  start_date DATE,
  end_date DATE,
  location TEXT,
  price_description TEXT,
  website_url TEXT,
  contact_email TEXT,
  stripe_subscription_id TEXT UNIQUE,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Newsletter Sponsor Inquiries
CREATE TABLE IF NOT EXISTS newsletter_sponsor_inquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  business_name TEXT,
  email TEXT,
  phone TEXT,
  preferred_tier TEXT,
  message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
