-- Fix demo contractor clients and wire active_contractor_id on lead sites.
-- Safe to run multiple times — uses INSERT WHERE NOT EXISTS + UPDATE to latest per trade.

DO $$
DECLARE
  v_id uuid;
BEGIN
  -- For each demo trade, insert a contractor client if none exists for that trade+email,
  -- then update ALL matching contractor_lead_sites to point to it.

  FOREACH v_id IN ARRAY ARRAY[]::uuid[] LOOP END LOOP; -- no-op to satisfy DECLARE

  -- HVAC
  SELECT id INTO v_id FROM contractor_clients
  WHERE trade = 'hvac' AND email = 'matt@detroitwebagent.com' LIMIT 1;
  IF v_id IS NULL THEN
    INSERT INTO contractor_clients (name, business_name, email, phone, trade, city, state, active, onboarded_at)
    VALUES ('John Murphy', 'Metro Detroit HVAC LLC', 'matt@detroitwebagent.com', '+13138064952', 'hvac', 'Detroit', 'MI', true, now())
    RETURNING id INTO v_id;
  END IF;
  UPDATE contractor_lead_sites SET active_contractor_id = v_id WHERE LOWER(trade) = 'hvac';

  -- Plumbing
  SELECT id INTO v_id FROM contractor_clients
  WHERE trade = 'plumbing' AND email = 'matt@detroitwebagent.com' LIMIT 1;
  IF v_id IS NULL THEN
    INSERT INTO contractor_clients (name, business_name, email, phone, trade, city, state, active, onboarded_at)
    VALUES ('Dave Kowalski', 'Great Lakes Plumbing Co', 'matt@detroitwebagent.com', '+13138064952', 'plumbing', 'Detroit', 'MI', true, now())
    RETURNING id INTO v_id;
  END IF;
  UPDATE contractor_lead_sites SET active_contractor_id = v_id WHERE LOWER(trade) = 'plumbing';

  -- Roofing
  SELECT id INTO v_id FROM contractor_clients
  WHERE trade = 'roofing' AND email = 'matt@detroitwebagent.com' LIMIT 1;
  IF v_id IS NULL THEN
    INSERT INTO contractor_clients (name, business_name, email, phone, trade, city, state, active, onboarded_at)
    VALUES ('Mike Szczepanski', 'Detroit Roofing Pros', 'matt@detroitwebagent.com', '+13138064952', 'roofing', 'Detroit', 'MI', true, now())
    RETURNING id INTO v_id;
  END IF;
  UPDATE contractor_lead_sites SET active_contractor_id = v_id WHERE LOWER(trade) = 'roofing';

  -- Electrical
  SELECT id INTO v_id FROM contractor_clients
  WHERE trade = 'electrical' AND email = 'matt@detroitwebagent.com' LIMIT 1;
  IF v_id IS NULL THEN
    INSERT INTO contractor_clients (name, business_name, email, phone, trade, city, state, active, onboarded_at)
    VALUES ('Tom Ostrowski', 'Motor City Electric Inc', 'matt@detroitwebagent.com', '+13138064952', 'electrical', 'Detroit', 'MI', true, now())
    RETURNING id INTO v_id;
  END IF;
  UPDATE contractor_lead_sites SET active_contractor_id = v_id WHERE LOWER(trade) = 'electrical';

  -- Boiler
  SELECT id INTO v_id FROM contractor_clients
  WHERE trade = 'boiler' AND email = 'matt@detroitwebagent.com' LIMIT 1;
  IF v_id IS NULL THEN
    INSERT INTO contractor_clients (name, business_name, email, phone, trade, city, state, active, onboarded_at)
    VALUES ('Steve Grzelak', 'Michigan Boiler Works', 'matt@detroitwebagent.com', '+13138064952', 'boiler', 'Detroit', 'MI', true, now())
    RETURNING id INTO v_id;
  END IF;
  UPDATE contractor_lead_sites SET active_contractor_id = v_id WHERE LOWER(trade) = 'boiler';

END $$;
