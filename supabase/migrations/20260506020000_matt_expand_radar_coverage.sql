-- 20260506020000_matt_expand_radar_coverage.sql
-- Two fixes:
-- 1) Mortgage Radar: Matt's 9 narrow Detroit ZIPs → all 118 SE Michigan ZIPs
--    + coverage_regions = ['Southeast Michigan'] so county-level leads also match.
-- 2) TechAlert: Expand target_zip_codes from 6 Detroit ZIPs → all 118 SE Michigan ZIPs
--    so hiring companies in Oakland/Macomb/Wayne suburbs are included.
--    Also adds a second healthcare-focused row so Matt sees the full client experience.

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

  -- =========================================================================
  -- 1. MORTGAGE RADAR — expand coverage to all of SE Michigan
  -- =========================================================================
  UPDATE public.mortgage_radar_clients
  SET
    zip_codes          = se_mi_zips,
    coverage_regions   = ARRAY['Southeast Michigan'],
    coverage_counties  = ARRAY['Wayne','Oakland','Macomb','Washtenaw','Monroe','Livingston','St. Clair','Lenawee']
  WHERE email = 'matt@detroitwebagent.com';

  -- =========================================================================
  -- 2. TECHALERT — expand existing row to all SE Michigan ZIPs
  -- =========================================================================
  UPDATE public.hire_alert_clients
  SET target_zip_codes = se_mi_zips
  WHERE owner_email = 'matt@detroitwebagent.com';

  -- =========================================================================
  -- 3. TECHALERT — add a healthcare-focused row so Matt sees that client view
  -- =========================================================================
  INSERT INTO public.hire_alert_clients
    (id, company_name, owner_email, owner_phone, active, plan,
     target_roles, target_zip_codes, notify_email, notify_sms, dashboard_token)
  VALUES
    ('bb000002-test-0002-0002-000000000002',
     'DWA Test — Healthcare', 'matt@detroitwebagent.com', '+13139921219',
     true, 'standalone',
     ARRAY['rn','lpn','cna','medical_assistant','healthcare_tech','surgical_tech'],
     se_mi_zips,
     true, false,
     'matt-test-techalert-healthcare-0001')
  ON CONFLICT (id) DO UPDATE SET
    target_zip_codes = se_mi_zips,
    target_roles = ARRAY['rn','lpn','cna','medical_assistant','healthcare_tech','surgical_tech'],
    active = true;

END $$;
