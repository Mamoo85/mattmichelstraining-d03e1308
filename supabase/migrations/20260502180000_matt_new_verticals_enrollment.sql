-- Enroll matt@detroitwebagent.com in 5 new Trade Radar verticals:
-- tree, restoration, demo_junk, foundation, exterior (replaces painting).
-- Fixed UUIDs — safe to re-run (ON CONFLICT DO UPDATE).

DO $$
DECLARE
  se_mi_zips TEXT[] := ARRAY[
    '48201','48202','48203','48204','48205','48206','48207','48208','48209','48210',
    '48211','48212','48213','48214','48215','48216','48217','48218','48219','48220',
    '48221','48222','48223','48224','48225','48226','48227','48228','48229','48230',
    '48233','48234','48235','48236','48237','48238','48239','48240','48242','48243',
    '48301','48302','48303','48304','48306','48307','48308','48309','48310','48311',
    '48312','48313','48314','48315','48316','48317','48318','48320','48321','48322',
    '48323','48324','48325','48326','48327','48328','48329','48330','48331','48332',
    '48333','48334','48335','48336','48340','48341','48342','48343','48346','48347',
    '48348','48350','48356','48357','48359','48360','48361','48362','48363','48366',
    '48367','48370','48371','48374','48375','48376','48377','48380','48381','48382',
    '48383','48386','48390','48391','48393','48397','48030','48033','48034','48035',
    '48036','48038','48042','48043','48044','48045','48046','48047','48048','48050',
    '48051','48054','48060','48062','48063','48064','48065','48066','48067','48068'
  ];
BEGIN
  -- Tree Radar
  INSERT INTO public.trade_radar_clients
    (id, email, contact_name, business_name, phone, vertical, zip_codes, active)
  VALUES
    ('fa000001-trad-0001-0001-000000000008',
     'matt@detroitwebagent.com', 'Matt Michels', 'Detroit Web Agency',
     '+13139921219', 'tree', se_mi_zips, true)
  ON CONFLICT (email, vertical) DO UPDATE SET
    active = true, zip_codes = se_mi_zips, contact_name = 'Matt Michels';

  -- Restoration Radar
  INSERT INTO public.trade_radar_clients
    (id, email, contact_name, business_name, phone, vertical, zip_codes, active)
  VALUES
    ('fa000001-trad-0001-0001-000000000009',
     'matt@detroitwebagent.com', 'Matt Michels', 'Detroit Web Agency',
     '+13139921219', 'restoration', se_mi_zips, true)
  ON CONFLICT (email, vertical) DO UPDATE SET
    active = true, zip_codes = se_mi_zips, contact_name = 'Matt Michels';

  -- Demo & Junk Radar
  INSERT INTO public.trade_radar_clients
    (id, email, contact_name, business_name, phone, vertical, zip_codes, active)
  VALUES
    ('fa000001-trad-0001-0001-000000000010',
     'matt@detroitwebagent.com', 'Matt Michels', 'Detroit Web Agency',
     '+13139921219', 'demo_junk', se_mi_zips, true)
  ON CONFLICT (email, vertical) DO UPDATE SET
    active = true, zip_codes = se_mi_zips, contact_name = 'Matt Michels';

  -- Foundation Radar
  INSERT INTO public.trade_radar_clients
    (id, email, contact_name, business_name, phone, vertical, zip_codes, active)
  VALUES
    ('fa000001-trad-0001-0001-000000000011',
     'matt@detroitwebagent.com', 'Matt Michels', 'Detroit Web Agency',
     '+13139921219', 'foundation', se_mi_zips, true)
  ON CONFLICT (email, vertical) DO UPDATE SET
    active = true, zip_codes = se_mi_zips, contact_name = 'Matt Michels';

  -- Exterior Radar (replaces Painting)
  INSERT INTO public.trade_radar_clients
    (id, email, contact_name, business_name, phone, vertical, zip_codes, active)
  VALUES
    ('fa000001-trad-0001-0001-000000000012',
     'matt@detroitwebagent.com', 'Matt Michels', 'Detroit Web Agency',
     '+13139921219', 'exterior', se_mi_zips, true)
  ON CONFLICT (email, vertical) DO UPDATE SET
    active = true, zip_codes = se_mi_zips, contact_name = 'Matt Michels';
END $$;
