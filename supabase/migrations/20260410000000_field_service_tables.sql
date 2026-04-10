-- Field Service Management — Detroit Web Agency
-- Tables for dispatch, jobs, techs, customers, GPS, invoicing

-- ── Company accounts (one row per business) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS field_service_clients (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name      text NOT NULL,
  owner_name        text,
  owner_email       text,
  owner_phone       text,
  plan              text NOT NULL DEFAULT 'standalone' CHECK (plan IN ('standalone', 'bundle')),
  stripe_customer_id text,
  active            boolean NOT NULL DEFAULT true,
  settings          jsonb NOT NULL DEFAULT '{}',
  created_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE field_service_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON field_service_clients
  FOR ALL USING (auth.role() = 'service_role');

-- ── Technicians ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS field_service_techs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id  uuid NOT NULL REFERENCES field_service_clients(id) ON DELETE CASCADE,
  name       text NOT NULL,
  phone      text,
  email      text,
  role       text NOT NULL DEFAULT 'tech' CHECK (role IN ('tech', 'dispatcher', 'admin')),
  pin        text,
  avatar_url text,
  active     boolean NOT NULL DEFAULT true,
  gps_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE field_service_techs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON field_service_techs
  FOR ALL USING (auth.role() = 'service_role');

-- ── End customers (the businesses being serviced) ────────────────────────────
CREATE TABLE IF NOT EXISTS field_service_customers (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id    uuid NOT NULL REFERENCES field_service_clients(id) ON DELETE CASCADE,
  company_name text,
  contact_name text,
  phone        text,
  email        text,
  address      text,
  city         text,
  state        text,
  zip          text,
  lat          numeric,
  lng          numeric,
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE field_service_customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON field_service_customers
  FOR ALL USING (auth.role() = 'service_role');

-- ── Work orders ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS field_service_jobs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id        uuid NOT NULL REFERENCES field_service_clients(id) ON DELETE CASCADE,
  customer_id      uuid REFERENCES field_service_customers(id) ON DELETE SET NULL,
  assigned_tech_id uuid REFERENCES field_service_techs(id) ON DELETE SET NULL,
  title            text NOT NULL,
  description      text,
  priority         text NOT NULL DEFAULT 'normal' CHECK (priority IN ('emergency', 'high', 'normal', 'low')),
  status           text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'assigned', 'en_route', 'on_site', 'completed', 'invoiced')),
  scheduled_date   date,
  scheduled_time   text,
  started_at       timestamptz,
  completed_at     timestamptz,
  duration_minutes integer,
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE field_service_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON field_service_jobs
  FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_field_service_jobs_client_status ON field_service_jobs(client_id, status);
CREATE INDEX IF NOT EXISTS idx_field_service_jobs_tech ON field_service_jobs(assigned_tech_id);

-- ── Job photos ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS job_photos (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id    uuid NOT NULL REFERENCES field_service_jobs(id) ON DELETE CASCADE,
  photo_url text NOT NULL,
  caption   text,
  taken_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE job_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON job_photos
  FOR ALL USING (auth.role() = 'service_role');

-- ── Job notes ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS job_notes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id     uuid NOT NULL REFERENCES field_service_jobs(id) ON DELETE CASCADE,
  tech_id    uuid REFERENCES field_service_techs(id) ON DELETE SET NULL,
  note       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE job_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON job_notes
  FOR ALL USING (auth.role() = 'service_role');

-- ── GPS pings from tech phones ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tech_locations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tech_id     uuid NOT NULL REFERENCES field_service_techs(id) ON DELETE CASCADE,
  lat         numeric NOT NULL,
  lng         numeric NOT NULL,
  accuracy    numeric,
  recorded_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE tech_locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON tech_locations
  FOR ALL USING (auth.role() = 'service_role');

-- Only keep last 24h of GPS data to save space
CREATE INDEX IF NOT EXISTS idx_tech_locations_tech_time ON tech_locations(tech_id, recorded_at DESC);

-- ── Invoices ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS field_service_invoices (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id         uuid REFERENCES field_service_jobs(id) ON DELETE SET NULL,
  client_id      uuid NOT NULL REFERENCES field_service_clients(id) ON DELETE CASCADE,
  customer_id    uuid REFERENCES field_service_customers(id) ON DELETE SET NULL,
  amount_cents   integer NOT NULL DEFAULT 0,
  tax_cents      integer NOT NULL DEFAULT 0,
  status         text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid')),
  qb_invoice_id  text,
  sent_at        timestamptz,
  paid_at        timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE field_service_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON field_service_invoices
  FOR ALL USING (auth.role() = 'service_role');
