-- seed_tracked_shops — 20 top Etsy competitor shops for DWA internal calibration cohort
-- user_id = '00000000-0000-0000-0000-000000000001' is the DWA sentinel (public/internal)
-- Verticals: pod | gifts | apparel | drinkware | digital | 3dprint

INSERT INTO tracked_shops (user_id, shop_name, shop_url, vertical, active)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'PersonalizationMall',  'https://www.etsy.com/shop/PersonalizationMall',  'gifts',     true),
  ('00000000-0000-0000-0000-000000000001', 'CaitlynMinimalist',    'https://www.etsy.com/shop/CaitlynMinimalist',    'gifts',     true),
  ('00000000-0000-0000-0000-000000000001', 'ModParty',             'https://www.etsy.com/shop/ModParty',             'gifts',     true),
  ('00000000-0000-0000-0000-000000000001', 'TheCrownPrints',       'https://www.etsy.com/shop/TheCrownPrints',       'pod',       true),
  ('00000000-0000-0000-0000-000000000001', 'PiperLouCollection',   'https://www.etsy.com/shop/PiperLouCollection',   'apparel',   true),
  ('00000000-0000-0000-0000-000000000001', 'Mugsby',               'https://www.etsy.com/shop/Mugsby',               'drinkware', true),
  ('00000000-0000-0000-0000-000000000001', 'ZoeysAttic',           'https://www.etsy.com/shop/ZoeysAttic',           'gifts',     true),
  ('00000000-0000-0000-0000-000000000001', 'TheCreativeRaccoon',   'https://www.etsy.com/shop/TheCreativeRaccoon',   'pod',       true),
  ('00000000-0000-0000-0000-000000000001', 'TheSaltyHustle',       'https://www.etsy.com/shop/TheSaltyHustle',       'apparel',   true),
  ('00000000-0000-0000-0000-000000000001', 'PlannerKate',          'https://www.etsy.com/shop/PlannerKate',          'digital',   true),
  ('00000000-0000-0000-0000-000000000001', 'Shop3D',               'https://www.etsy.com/shop/Shop3D',               '3dprint',   true),
  ('00000000-0000-0000-0000-000000000001', 'DesignMakers',         'https://www.etsy.com/shop/DesignMakers',         'digital',   true),
  ('00000000-0000-0000-0000-000000000001', 'NicheGiftCo',          'https://www.etsy.com/shop/NicheGiftCo',          'gifts',     true),
  ('00000000-0000-0000-0000-000000000001', 'SimplyNameIt',         'https://www.etsy.com/shop/SimplyNameIt',         'gifts',     true),
  ('00000000-0000-0000-0000-000000000001', 'ILYBDesigns',          'https://www.etsy.com/shop/ILYBDesigns',          'pod',       true),
  ('00000000-0000-0000-0000-000000000001', 'Frostbeard',           'https://www.etsy.com/shop/Frostbeard',           'drinkware', true),
  ('00000000-0000-0000-0000-000000000001', 'BellaAndCanvasTees',   'https://www.etsy.com/shop/BellaAndCanvasTees',   'apparel',   true),
  ('00000000-0000-0000-0000-000000000001', 'PrintAndClay',         'https://www.etsy.com/shop/PrintAndClay',         'pod',       true),
  ('00000000-0000-0000-0000-000000000001', 'LittleWeeShop',        'https://www.etsy.com/shop/LittleWeeShop',        'gifts',     true),
  ('00000000-0000-0000-0000-000000000001', 'TheMugBoutique',       'https://www.etsy.com/shop/TheMugBoutique',       'drinkware', true)
ON CONFLICT (user_id, shop_name) DO NOTHING;
