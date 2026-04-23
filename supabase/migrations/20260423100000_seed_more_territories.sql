-- Seed additional contractor territories for Boiler, Gutters, Siding trades
-- and expand HVAC/Plumbing/Electrical/Roofing to more Metro Detroit cities.
-- All ON CONFLICT DO NOTHING — safe to re-run.

INSERT INTO contractor_lead_sites (trade, city, state, slug, active) VALUES

-- Boiler / Mechanical (7 cities with commercial/industrial boiler presence)
('Boiler', 'Detroit',         'MI', 'boiler-detroit',          true),
('Boiler', 'Dearborn',        'MI', 'boiler-dearborn',         true),
('Boiler', 'Sterling Heights','MI', 'boiler-sterling-heights', true),
('Boiler', 'Warren',          'MI', 'boiler-warren',           true),
('Boiler', 'Livonia',         'MI', 'boiler-livonia',          true),
('Boiler', 'Troy',            'MI', 'boiler-troy',             true),
('Boiler', 'Southfield',      'MI', 'boiler-southfield',       true),

-- Gutters (7 residential-heavy suburbs)
('Gutters', 'Troy',            'MI', 'gutters-troy',            true),
('Gutters', 'Birmingham',      'MI', 'gutters-birmingham',      true),
('Gutters', 'Bloomfield Hills','MI', 'gutters-bloomfield-hills',true),
('Gutters', 'Novi',            'MI', 'gutters-novi',            true),
('Gutters', 'Canton',          'MI', 'gutters-canton',          true),
('Gutters', 'Northville',      'MI', 'gutters-northville',      true),
('Gutters', 'Plymouth',        'MI', 'gutters-plymouth',        true),

-- Siding (7 residential-heavy suburbs)
('Siding', 'Troy',            'MI', 'siding-troy',             true),
('Siding', 'Birmingham',      'MI', 'siding-birmingham',       true),
('Siding', 'Bloomfield Hills','MI', 'siding-bloomfield-hills', true),
('Siding', 'Novi',            'MI', 'siding-novi',             true),
('Siding', 'Canton',          'MI', 'siding-canton',           true),
('Siding', 'Northville',      'MI', 'siding-northville',       true),
('Siding', 'Plymouth',        'MI', 'siding-plymouth',         true),

-- Expand HVAC (5 more cities)
('HVAC', 'Troy',           'MI', 'hvac-troy',            true),
('HVAC', 'Southfield',     'MI', 'hvac-southfield',      true),
('HVAC', 'Novi',           'MI', 'hvac-novi',            true),
('HVAC', 'Canton',         'MI', 'hvac-canton',          true),
('HVAC', 'Royal Oak',      'MI', 'hvac-royal-oak',       true),

-- Expand Plumbing (5 more cities)
('Plumbing', 'Warren',          'MI', 'plumbing-warren',          true),
('Plumbing', 'Novi',            'MI', 'plumbing-novi',            true),
('Plumbing', 'Canton',          'MI', 'plumbing-canton',          true),
('Plumbing', 'Royal Oak',       'MI', 'plumbing-royal-oak',       true),
('Plumbing', 'Farmington Hills','MI', 'plumbing-farmington-hills', true),

-- Expand Electrical (5 more cities)
('Electrical', 'Southfield',      'MI', 'electrical-southfield',       true),
('Electrical', 'Farmington Hills','MI', 'electrical-farmington-hills', true),
('Electrical', 'Royal Oak',       'MI', 'electrical-royal-oak',        true),
('Electrical', 'Canton',          'MI', 'electrical-canton',           true),
('Electrical', 'Novi',            'MI', 'electrical-novi',             true),

-- Expand Roofing (5 more cities)
('Roofing', 'Dearborn',       'MI', 'roofing-dearborn',       true),
('Roofing', 'Livonia',        'MI', 'roofing-livonia',         true),
('Roofing', 'Sterling Heights','MI','roofing-sterling-heights', true),
('Roofing', 'Canton',         'MI', 'roofing-canton',          true),
('Roofing', 'Novi',           'MI', 'roofing-novi',            true)

ON CONFLICT (slug) DO NOTHING;
