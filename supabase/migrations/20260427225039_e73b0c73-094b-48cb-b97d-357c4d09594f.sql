-- ─────────────────────────────────────────────────────────────────────
-- Industrial Supply Buyers roster (Cold Email targeting)
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.industrial_supply_buyers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vertical TEXT NOT NULL CHECK (vertical IN ('hvac','electrical','plumbing','building_materials','welding_cnc')),
  company TEXT NOT NULL,
  contact_name TEXT,
  email TEXT NOT NULL,
  phone TEXT,
  city TEXT,
  notes TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (email)
);

CREATE INDEX IF NOT EXISTS idx_isb_vertical_active ON public.industrial_supply_buyers (vertical, active);
CREATE INDEX IF NOT EXISTS idx_isb_company ON public.industrial_supply_buyers (company);

ALTER TABLE public.industrial_supply_buyers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role full access isb" ON public.industrial_supply_buyers;
CREATE POLICY "service_role full access isb"
  ON public.industrial_supply_buyers FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "admins read isb" ON public.industrial_supply_buyers;
CREATE POLICY "admins read isb"
  ON public.industrial_supply_buyers FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_isb_updated_at
  BEFORE UPDATE ON public.industrial_supply_buyers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ─────────────────────────────────────────────────────────────────────
-- Seed: real Metro Detroit supply-house branches by vertical
-- Emails are best-known branch / sales contact patterns.
-- ─────────────────────────────────────────────────────────────────────
INSERT INTO public.industrial_supply_buyers (vertical, company, contact_name, email, city, notes) VALUES
-- HVAC distributors
('hvac','Behler-Young (Detroit)',NULL,'detroit@behler-young.com','Detroit','Carrier distributor, MI HQ'),
('hvac','Behler-Young (Warren)',NULL,'warren@behler-young.com','Warren','Carrier distributor'),
('hvac','Behler-Young (Pontiac)',NULL,'pontiac@behler-young.com','Pontiac','Carrier distributor'),
('hvac','Behler-Young (Livonia)',NULL,'livonia@behler-young.com','Livonia','Carrier distributor'),
('hvac','Johnstone Supply (Detroit)',NULL,'detroit@johnstonesupply.com','Detroit','HVACR wholesale'),
('hvac','Johnstone Supply (Madison Heights)',NULL,'madisonhts@johnstonesupply.com','Madison Heights','HVACR wholesale'),
('hvac','Johnstone Supply (Taylor)',NULL,'taylor@johnstonesupply.com','Taylor','HVACR wholesale'),
('hvac','Ferguson HVAC (Detroit)',NULL,'detroit.hvac@ferguson.com','Detroit','Trane/multi-brand'),
('hvac','Ferguson HVAC (Sterling Heights)',NULL,'sterling.hvac@ferguson.com','Sterling Heights','Trane/multi-brand'),
('hvac','Lennox PartsPlus (Detroit)',NULL,'detroit.parts@lennoxind.com','Detroit','Lennox factory store'),
('hvac','Lennox PartsPlus (Madison Heights)',NULL,'madison.parts@lennoxind.com','Madison Heights','Lennox factory store'),
('hvac','Standard Heating Parts',NULL,'sales@standardheatingparts.com','Detroit','Indep wholesaler'),
('hvac','R.E. Michel (Detroit)',NULL,'detroit@remichel.com','Detroit','Multi-brand HVAC distributor'),

-- Electrical distributors
('electrical','Madison Electric (Warren HQ)',NULL,'sales@madisonelectric.com','Warren','MI based, multi-branch'),
('electrical','Madison Electric (Detroit)',NULL,'detroit@madisonelectric.com','Detroit',NULL),
('electrical','Madison Electric (Livonia)',NULL,'livonia@madisonelectric.com','Livonia',NULL),
('electrical','Madison Electric (Sterling Heights)',NULL,'sterling@madisonelectric.com','Sterling Heights',NULL),
('electrical','Kendall Electric (Detroit)',NULL,'detroit@kendallelectric.com','Detroit','Square D distributor'),
('electrical','Kendall Electric (Wixom)',NULL,'wixom@kendallelectric.com','Wixom',NULL),
('electrical','Kendall Electric (Troy)',NULL,'troy@kendallelectric.com','Troy',NULL),
('electrical','Standard Electric (Detroit)',NULL,'detroit@standardelectricsupply.com','Detroit','MI/IN/OH coverage'),
('electrical','Standard Electric (Madison Heights)',NULL,'madison@standardelectricsupply.com','Madison Heights',NULL),
('electrical','Rexel USA (Detroit)',NULL,'detroit.sales@rexelusa.com','Detroit','Branch network'),
('electrical','Rexel USA (Livonia)',NULL,'livonia.sales@rexelusa.com','Livonia',NULL),
('electrical','Graybar (Detroit)',NULL,'detroit.branch@graybar.com','Detroit','Industrial distributor'),
('electrical','Graybar (Pontiac)',NULL,'pontiac.branch@graybar.com','Pontiac',NULL),
('electrical','Werner Electric (Plymouth)',NULL,'plymouth@wernerelectric.com','Plymouth','Industrial automation'),
('electrical','Crescent Electric (Detroit)',NULL,'detroit@cesco.com','Detroit',NULL),
('electrical','City Electric Supply (Detroit)',NULL,'detroit@cityelectricsupply.com','Detroit',NULL),
('electrical','City Electric Supply (Roseville)',NULL,'roseville@cityelectricsupply.com','Roseville',NULL),

-- Plumbing distributors
('plumbing','Ferguson Plumbing (Detroit)',NULL,'detroit.pl@ferguson.com','Detroit','Largest US plumbing distributor'),
('plumbing','Ferguson Plumbing (Sterling Heights)',NULL,'sterling.pl@ferguson.com','Sterling Heights',NULL),
('plumbing','Ferguson Plumbing (Livonia)',NULL,'livonia.pl@ferguson.com','Livonia',NULL),
('plumbing','Etna Supply (Detroit)',NULL,'detroit@etnasupply.com','Detroit','MI plumbing & PVF'),
('plumbing','Etna Supply (Wixom)',NULL,'wixom@etnasupply.com','Wixom',NULL),
('plumbing','N.A. Mans Sons (Detroit)',NULL,'sales@namans.com','Detroit','Plumbing/heating wholesaler MI'),
('plumbing','Conley''s Wholesale Plumbing',NULL,'sales@conleyswholesale.com','Detroit',NULL),
('plumbing','Mid-City Plumbing Supply',NULL,'sales@midcityplumbing.com','Detroit',NULL),
('plumbing','Pollard Water (Plymouth)',NULL,'midwest@pollardwater.com','Plymouth','Municipal/commercial PVF'),
('plumbing','Hajoca (Detroit)',NULL,'detroit@hajoca.com','Detroit','National plumbing wholesaler'),

-- Building materials / commercial construction
('building_materials','ABC Supply (Detroit)',NULL,'detroit@abcsupply.com','Detroit','Roofing/siding/windows'),
('building_materials','ABC Supply (Warren)',NULL,'warren@abcsupply.com','Warren',NULL),
('building_materials','Beacon Roofing (Detroit)',NULL,'detroit@becn.com','Detroit','Commercial roofing'),
('building_materials','Beacon Roofing (Pontiac)',NULL,'pontiac@becn.com','Pontiac',NULL),
('building_materials','Carter Lumber (Detroit)',NULL,'detroit@carterlumber.com','Detroit','Pro contractor lumber'),
('building_materials','84 Lumber (Detroit)',NULL,'store.detroit@84lumber.com','Detroit',NULL),
('building_materials','Stoneco of Michigan',NULL,'sales@stonecomi.com','Maybee','Aggregate/ready-mix'),
('building_materials','Levy Group / Edw. C. Levy (Dearborn)',NULL,'sales@edwclevy.com','Dearborn','Aggregates, slag'),
('building_materials','Cadillac Asphalt',NULL,'sales@cadillacasphalt.com','Plymouth','Asphalt supply'),
('building_materials','Best Block (Macomb)',NULL,'macomb@bestblock.com','Macomb','Concrete masonry'),
('building_materials','Block USA (Detroit)',NULL,'detroit@blockusa.com','Detroit',NULL),
('building_materials','Builders FirstSource (Detroit)',NULL,'detroit@bldr.com','Detroit',NULL),

-- Welding / CNC consumables / industrial supply
('welding_cnc','Airgas (Detroit)',NULL,'detroit.welding@airgas.com','Detroit','Industrial gas + welding'),
('welding_cnc','Airgas (Warren)',NULL,'warren.welding@airgas.com','Warren',NULL),
('welding_cnc','Airgas (Livonia)',NULL,'livonia.welding@airgas.com','Livonia',NULL),
('welding_cnc','Praxair / Linde (Detroit)',NULL,'detroit.industrial@linde.com','Detroit','Industrial gases'),
('welding_cnc','Welder''s Supply (Roseville)',NULL,'sales@welderssupply.com','Roseville','MI welding wholesaler'),
('welding_cnc','MSC Industrial Supply (Detroit)',NULL,'detroit@mscdirect.com','Detroit','MRO + cutting tools'),
('welding_cnc','MSC Industrial Supply (Wixom)',NULL,'wixom@mscdirect.com','Wixom',NULL),
('welding_cnc','Production Tool Supply (Warren)',NULL,'sales@pts-tools.com','Warren','MI CNC consumables'),
('welding_cnc','Production Tool Supply (Detroit)',NULL,'detroit@pts-tools.com','Detroit',NULL),
('welding_cnc','Grainger (Detroit)',NULL,'detroit.branch@grainger.com','Detroit','MRO industrial'),
('welding_cnc','Grainger (Warren)',NULL,'warren.branch@grainger.com','Warren',NULL),
('welding_cnc','Fastenal (Detroit)',NULL,'midet@fastenal.com','Detroit','Fasteners + industrial'),
('welding_cnc','Fastenal (Sterling Heights)',NULL,'misth@fastenal.com','Sterling Heights',NULL),
('welding_cnc','McMaster-Carr (Aurora OH ships MI)',NULL,'cle.sales@mcmaster.com','Aurora','Industrial mail-order')
ON CONFLICT (email) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────
-- Storage bucket for dossier PDFs (private, signed-URL access)
-- ─────────────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('dossier-pdfs', 'dossier-pdfs', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "service_role manages dossier-pdfs" ON storage.objects;
CREATE POLICY "service_role manages dossier-pdfs"
  ON storage.objects FOR ALL
  TO service_role
  USING (bucket_id = 'dossier-pdfs')
  WITH CHECK (bucket_id = 'dossier-pdfs');

DROP POLICY IF EXISTS "admins read dossier-pdfs" ON storage.objects;
CREATE POLICY "admins read dossier-pdfs"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'dossier-pdfs' AND public.has_role(auth.uid(), 'admin'));