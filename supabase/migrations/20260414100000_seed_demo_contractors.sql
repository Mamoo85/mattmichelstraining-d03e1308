-- Seed demo contractor clients + lead sites for system testing.
-- All notifications route to Matt's phone/email so the full loop is testable.
-- $0 cost — inserted directly, no Stripe involved.

DO $$
DECLARE
  hvac_id      uuid := gen_random_uuid();
  plumbing_id  uuid := gen_random_uuid();
  roofing_id   uuid := gen_random_uuid();
  electrical_id uuid := gen_random_uuid();
  boiler_id    uuid := gen_random_uuid();
BEGIN

  -- ── Fake contractor clients ────────────────────────────────────────────────
  INSERT INTO contractor_clients (id, name, business_name, email, phone, trade, city, state, active, onboarded_at)
  VALUES
    (hvac_id,       'John Murphy',     'Metro Detroit HVAC LLC',     'matt@detroitwebagent.com', '+13138064952', 'hvac',        'Detroit', 'MI', true, now()),
    (plumbing_id,   'Dave Kowalski',   'Great Lakes Plumbing Co',    'matt@detroitwebagent.com', '+13138064952', 'plumbing',    'Detroit', 'MI', true, now()),
    (roofing_id,    'Mike Szczepanski','Detroit Roofing Pros',        'matt@detroitwebagent.com', '+13138064952', 'roofing',     'Detroit', 'MI', true, now()),
    (electrical_id, 'Tom Ostrowski',   'Motor City Electric Inc',     'matt@detroitwebagent.com', '+13138064952', 'electrical',  'Detroit', 'MI', true, now()),
    (boiler_id,     'Steve Grzelak',   'Michigan Boiler Works',       'matt@detroitwebagent.com', '+13138064952', 'boiler',      'Detroit', 'MI', true, now())
  ON CONFLICT DO NOTHING;

  -- ── Lead sites — Metro Detroit territories ────────────────────────────────
  -- HVAC
  INSERT INTO contractor_lead_sites (trade, city, state, slug, active_contractor_id, monthly_fee_cents, active)
  VALUES
    ('hvac', 'Detroit',         'MI', 'hvac-detroit',          hvac_id, 39900, true),
    ('hvac', 'Dearborn',        'MI', 'hvac-dearborn',         hvac_id, 39900, true),
    ('hvac', 'Warren',          'MI', 'hvac-warren',           hvac_id, 39900, true),
    ('hvac', 'Livonia',         'MI', 'hvac-livonia',          hvac_id, 39900, true),
    ('hvac', 'Troy',            'MI', 'hvac-troy',             hvac_id, 39900, true),
    ('hvac', 'Sterling Heights','MI', 'hvac-sterling-heights', hvac_id, 39900, true),
    ('hvac', 'Royal Oak',       'MI', 'hvac-royal-oak',        hvac_id, 39900, true),
    ('hvac', 'Pontiac',         'MI', 'hvac-pontiac',          hvac_id, 39900, true)
  ON CONFLICT (slug) DO UPDATE SET active_contractor_id = EXCLUDED.active_contractor_id, active = true;

  -- Plumbing
  INSERT INTO contractor_lead_sites (trade, city, state, slug, active_contractor_id, monthly_fee_cents, active)
  VALUES
    ('plumbing', 'Detroit',         'MI', 'plumbing-detroit',          plumbing_id, 39900, true),
    ('plumbing', 'Dearborn',        'MI', 'plumbing-dearborn',         plumbing_id, 39900, true),
    ('plumbing', 'Warren',          'MI', 'plumbing-warren',           plumbing_id, 39900, true),
    ('plumbing', 'Livonia',         'MI', 'plumbing-livonia',          plumbing_id, 39900, true),
    ('plumbing', 'Troy',            'MI', 'plumbing-troy',             plumbing_id, 39900, true),
    ('plumbing', 'Sterling Heights','MI', 'plumbing-sterling-heights', plumbing_id, 39900, true),
    ('plumbing', 'Royal Oak',       'MI', 'plumbing-royal-oak',        plumbing_id, 39900, true),
    ('plumbing', 'Pontiac',         'MI', 'plumbing-pontiac',          plumbing_id, 39900, true)
  ON CONFLICT (slug) DO UPDATE SET active_contractor_id = EXCLUDED.active_contractor_id, active = true;

  -- Roofing
  INSERT INTO contractor_lead_sites (trade, city, state, slug, active_contractor_id, monthly_fee_cents, active)
  VALUES
    ('roofing', 'Detroit',         'MI', 'roofing-detroit',          roofing_id, 39900, true),
    ('roofing', 'Dearborn',        'MI', 'roofing-dearborn',         roofing_id, 39900, true),
    ('roofing', 'Warren',          'MI', 'roofing-warren',           roofing_id, 39900, true),
    ('roofing', 'Livonia',         'MI', 'roofing-livonia',          roofing_id, 39900, true),
    ('roofing', 'Troy',            'MI', 'roofing-troy',             roofing_id, 39900, true),
    ('roofing', 'Sterling Heights','MI', 'roofing-sterling-heights', roofing_id, 39900, true),
    ('roofing', 'Royal Oak',       'MI', 'roofing-royal-oak',        roofing_id, 39900, true),
    ('roofing', 'Pontiac',         'MI', 'roofing-pontiac',          roofing_id, 39900, true)
  ON CONFLICT (slug) DO UPDATE SET active_contractor_id = EXCLUDED.active_contractor_id, active = true;

  -- Electrical
  INSERT INTO contractor_lead_sites (trade, city, state, slug, active_contractor_id, monthly_fee_cents, active)
  VALUES
    ('electrical', 'Detroit',         'MI', 'electrical-detroit',          electrical_id, 39900, true),
    ('electrical', 'Dearborn',        'MI', 'electrical-dearborn',         electrical_id, 39900, true),
    ('electrical', 'Warren',          'MI', 'electrical-warren',           electrical_id, 39900, true),
    ('electrical', 'Livonia',         'MI', 'electrical-livonia',          electrical_id, 39900, true),
    ('electrical', 'Troy',            'MI', 'electrical-troy',             electrical_id, 39900, true),
    ('electrical', 'Sterling Heights','MI', 'electrical-sterling-heights', electrical_id, 39900, true),
    ('electrical', 'Royal Oak',       'MI', 'electrical-royal-oak',        electrical_id, 39900, true),
    ('electrical', 'Pontiac',         'MI', 'electrical-pontiac',          electrical_id, 39900, true)
  ON CONFLICT (slug) DO UPDATE SET active_contractor_id = EXCLUDED.active_contractor_id, active = true;

  -- Boiler
  INSERT INTO contractor_lead_sites (trade, city, state, slug, active_contractor_id, monthly_fee_cents, active)
  VALUES
    ('boiler', 'Detroit',         'MI', 'boiler-detroit',          boiler_id, 39900, true),
    ('boiler', 'Dearborn',        'MI', 'boiler-dearborn',         boiler_id, 39900, true),
    ('boiler', 'Warren',          'MI', 'boiler-warren',           boiler_id, 39900, true),
    ('boiler', 'Livonia',         'MI', 'boiler-livonia',          boiler_id, 39900, true),
    ('boiler', 'Troy',            'MI', 'boiler-troy',             boiler_id, 39900, true),
    ('boiler', 'Sterling Heights','MI', 'boiler-sterling-heights', boiler_id, 39900, true),
    ('boiler', 'Royal Oak',       'MI', 'boiler-royal-oak',        boiler_id, 39900, true),
    ('boiler', 'Pontiac',         'MI', 'boiler-pontiac',          boiler_id, 39900, true)
  ON CONFLICT (slug) DO UPDATE SET active_contractor_id = EXCLUDED.active_contractor_id, active = true;

END $$;
