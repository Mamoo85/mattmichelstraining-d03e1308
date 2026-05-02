-- Trade Radar: clients + leads tables for 7 trade verticals.
CREATE TABLE IF NOT EXISTS public.trade_radar_clients (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  email               TEXT NOT NULL,
  contact_name        TEXT,
  business_name       TEXT,
  phone               TEXT,
  vertical            TEXT NOT NULL,
  zip_codes           TEXT[] NOT NULL DEFAULT '{}',
  active              BOOLEAN NOT NULL DEFAULT true,
  stripe_customer_id  TEXT,
  stripe_subscription_id TEXT,
  trial_ends_at       TIMESTAMPTZ,
  dashboard_token     TEXT UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  UNIQUE (email, vertical)
);

ALTER TABLE public.trade_radar_clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_trade_radar_clients"
  ON public.trade_radar_clients FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "admin_all_trade_radar_clients"
  ON public.trade_radar_clients FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.trade_radar_leads (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  vertical            TEXT NOT NULL,
  full_name           TEXT,
  address             TEXT,
  city                TEXT,
  zip                 TEXT,
  lat                 NUMERIC,
  lon                 NUMERIC,
  county              TEXT,
  region              TEXT,
  signal_type         TEXT,
  signal_detail       TEXT,
  signal_date         DATE,
  score               INTEGER NOT NULL DEFAULT 5,
  suggested_opener    TEXT,
  best_call_window    TEXT,
  estimated_value     NUMERIC,
  intel_highlights    TEXT[],
  signal_count        INTEGER NOT NULL DEFAULT 1,
  last_signal_at      TIMESTAMPTZ DEFAULT now(),
  source_method       TEXT,
  raw_source_data     JSONB,
  quarantine_reason   TEXT,
  status              TEXT NOT NULL DEFAULT 'new',
  UNIQUE (vertical, address, zip)
);

ALTER TABLE public.trade_radar_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_trade_radar_leads"
  ON public.trade_radar_leads FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "admin_all_trade_radar_leads"
  ON public.trade_radar_leads FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_trade_radar_leads_vertical_created
  ON public.trade_radar_leads (vertical, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trade_radar_leads_zip
  ON public.trade_radar_leads (zip);
CREATE INDEX IF NOT EXISTS idx_trade_radar_leads_score
  ON public.trade_radar_leads (score DESC);
CREATE INDEX IF NOT EXISTS idx_trade_radar_clients_vertical_active
  ON public.trade_radar_clients (vertical, active);

-- Enroll Matt as active founder in all 7 verticals (118 SE Michigan ZIPs)
DO $enroll$
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
  verticals TEXT[] := ARRAY['roofing','hvac','plumbing','electrical','pest_control','gutters','painting'];
  v TEXT;
BEGIN
  FOREACH v IN ARRAY verticals LOOP
    INSERT INTO public.trade_radar_clients
      (email, contact_name, business_name, phone, vertical, zip_codes, active, trial_ends_at)
    VALUES
      ('matt@detroitwebagent.com', 'Matt Michels', 'Detroit Web Agency',
       '+13139921219', v, se_mi_zips, true, now() + interval '90 days')
    ON CONFLICT (email, vertical) DO UPDATE SET
      active = true, zip_codes = se_mi_zips, contact_name = 'Matt Michels',
      business_name = 'Detroit Web Agency', phone = '+13139921219';
  END LOOP;
END
$enroll$;