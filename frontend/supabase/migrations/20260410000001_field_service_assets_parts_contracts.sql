-- Equipment/Asset tracking (per boiler unit, per piece of equipment)
CREATE TABLE IF NOT EXISTS field_service_assets (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id         uuid NOT NULL REFERENCES field_service_clients(id) ON DELETE CASCADE,
  customer_id       uuid REFERENCES field_service_customers(id) ON DELETE SET NULL,
  name              text NOT NULL,           -- e.g. "Boiler Unit #4"
  asset_type        text,                    -- e.g. "boiler", "hvac", "compressor"
  manufacturer      text,
  model             text,
  serial_number     text,
  install_date      date,
  last_service_at   timestamptz,
  location_notes    text,                    -- "Basement, east wall"
  notes             text,
  active            boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE field_service_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON field_service_assets FOR ALL USING (auth.role() = 'service_role');
CREATE INDEX idx_field_service_assets_customer ON field_service_assets(customer_id);

-- Add asset_id to jobs so jobs link to specific equipment
ALTER TABLE field_service_jobs ADD COLUMN IF NOT EXISTS asset_id uuid REFERENCES field_service_assets(id) ON DELETE SET NULL;

-- Parts/materials used on a job
CREATE TABLE IF NOT EXISTS job_parts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id        uuid NOT NULL REFERENCES field_service_jobs(id) ON DELETE CASCADE,
  part_name     text NOT NULL,
  part_number   text,
  quantity      numeric NOT NULL DEFAULT 1,
  unit_cost_cents integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE job_parts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON job_parts FOR ALL USING (auth.role() = 'service_role');

-- Service contracts (recurring maintenance schedules)
CREATE TABLE IF NOT EXISTS field_service_contracts (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id        uuid NOT NULL REFERENCES field_service_clients(id) ON DELETE CASCADE,
  customer_id      uuid REFERENCES field_service_customers(id) ON DELETE SET NULL,
  asset_id         uuid REFERENCES field_service_assets(id) ON DELETE SET NULL,
  title            text NOT NULL,
  description      text,
  frequency        text NOT NULL CHECK (frequency IN ('weekly','monthly','quarterly','biannual','annual')),
  assigned_tech_id uuid REFERENCES field_service_techs(id) ON DELETE SET NULL,
  next_due_date    date NOT NULL,
  active           boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE field_service_contracts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON field_service_contracts FOR ALL USING (auth.role() = 'service_role');
CREATE INDEX idx_field_service_contracts_due ON field_service_contracts(next_due_date) WHERE active = true;
