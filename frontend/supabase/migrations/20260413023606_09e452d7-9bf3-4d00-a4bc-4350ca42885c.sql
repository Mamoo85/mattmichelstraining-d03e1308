-- Seed contractor clients for Metro Detroit trades (idempotent)
INSERT INTO contractor_clients (business_name, email, phone, trade, city, state, name, active)
VALUES
  ('Detroit Plumbing Pros', 'matt@detroitwebagent.com', '+13138064952', 'plumbing', 'Detroit', 'MI', 'Matt Michels', true),
  ('Detroit HVAC Experts', 'matt@detroitwebagent.com', '+13138064952', 'hvac', 'Detroit', 'MI', 'Matt Michels', true),
  ('Detroit Roofing Co', 'matt@detroitwebagent.com', '+13138064952', 'roofing', 'Detroit', 'MI', 'Matt Michels', true),
  ('Detroit Electrical Services', 'matt@detroitwebagent.com', '+13138064952', 'electrical', 'Detroit', 'MI', 'Matt Michels', true),
  ('Detroit Boiler Works', 'matt@detroitwebagent.com', '+13138064952', 'boiler', 'Detroit', 'MI', 'Matt Michels', true)
ON CONFLICT DO NOTHING;

-- Seed contractor lead sites for Metro Detroit (idempotent via slug unique check)
INSERT INTO contractor_lead_sites (trade, city, state, slug, active_contractor_id)
SELECT 'plumbing', 'Detroit', 'MI', 'plumber-detroit', id FROM contractor_clients WHERE trade='plumbing' AND email='matt@detroitwebagent.com' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO contractor_lead_sites (trade, city, state, slug, active_contractor_id)
SELECT 'hvac', 'Detroit', 'MI', 'hvac-detroit', id FROM contractor_clients WHERE trade='hvac' AND email='matt@detroitwebagent.com' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO contractor_lead_sites (trade, city, state, slug, active_contractor_id)
SELECT 'roofing', 'Detroit', 'MI', 'roofing-detroit', id FROM contractor_clients WHERE trade='roofing' AND email='matt@detroitwebagent.com' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO contractor_lead_sites (trade, city, state, slug, active_contractor_id)
SELECT 'electrical', 'Detroit', 'MI', 'electrician-detroit', id FROM contractor_clients WHERE trade='electrical' AND email='matt@detroitwebagent.com' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO contractor_lead_sites (trade, city, state, slug, active_contractor_id)
SELECT 'boiler', 'Detroit', 'MI', 'boiler-detroit', id FROM contractor_clients WHERE trade='boiler' AND email='matt@detroitwebagent.com' LIMIT 1
ON CONFLICT DO NOTHING;

-- Backfill orphaned leads
UPDATE contractor_leads cl
SET site_id = cls.id
FROM contractor_lead_sites cls
WHERE cl.site_id IS NULL
  AND (
    (LOWER(cls.trade) = 'plumbing' AND LOWER(cl.project_type) ILIKE '%plumb%')
    OR (LOWER(cls.trade) = 'electrical' AND LOWER(cl.project_type) ILIKE '%electr%')
    OR (LOWER(cls.trade) = 'roofing' AND LOWER(cl.project_type) ILIKE '%roof%')
    OR (LOWER(cls.trade) = 'hvac' AND LOWER(cl.project_type) ILIKE '%hvac%')
    OR (LOWER(cls.trade) = 'boiler' AND LOWER(cl.project_type) ILIKE '%boiler%')
  );