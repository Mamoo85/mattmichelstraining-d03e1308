-- Predictive Sales: admin-editable product catalog mirror of src/data/productCatalog.ts
CREATE TABLE IF NOT EXISTS public.dwa_product_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  umbrella_name TEXT NOT NULL,
  legacy_name TEXT NOT NULL,
  tagline TEXT NOT NULL,
  monthly_price NUMERIC NOT NULL DEFAULT 0,
  route TEXT NOT NULL,
  recommended_industries TEXT[] NOT NULL DEFAULT '{}',
  excluded_industries TEXT[] NOT NULL DEFAULT '{}',
  in_predictive_family BOOLEAN NOT NULL DEFAULT TRUE,
  display_order INT NOT NULL DEFAULT 100,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.dwa_product_catalog ENABLE ROW LEVEL SECURITY;

-- Public read (needed for /predictive-sales landing page rendering)
CREATE POLICY "Catalog is publicly readable"
ON public.dwa_product_catalog FOR SELECT
USING (active = TRUE);

-- Service role full access
CREATE POLICY "Service role manages catalog"
ON public.dwa_product_catalog FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Admin manage
CREATE POLICY "Admins manage catalog"
ON public.dwa_product_catalog FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_dwa_product_catalog_updated_at
BEFORE UPDATE ON public.dwa_product_catalog
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed from productCatalog.ts
INSERT INTO public.dwa_product_catalog
  (slug, umbrella_name, legacy_name, tagline, monthly_price, route, recommended_industries, excluded_industries, in_predictive_family, display_order)
VALUES
  ('demand_radar', 'Predictive Sales — Active Buyers Right Now', 'Demand Radar',
   'Live RFPs, bid awards, and procurement signals from MITN, BidNet, and 40+ public sources — texted to you the moment they post.',
   149, '/demand-radar',
   ARRAY['Boiler Service','HVAC','Plumbing','Electrical','Roofing','General Contractor','Field Service (multi-trade)'],
   ARRAY['Mortgage Broker','Real Estate'], TRUE, 10),
  ('buyer_radar', 'Predictive Sales — Companies in Buying Mode', 'Buyer Radar',
   'Spot companies showing buying intent before they reach out — funding rounds, expansion permits, leadership changes, hiring surges.',
   199, '/buyer-radar',
   ARRAY['Boiler Service','HVAC','Electrical','General Contractor','Auto Manufacturing','Professional Services'],
   ARRAY['Mortgage Broker','Real Estate'], TRUE, 20),
  ('industry_pulse', 'Predictive Sales — Market Trend Map', 'Industry Pulse / Growth Radar',
   'See which sub-segments of your market are heating up week-over-week. Permit velocity, hiring trends, capital flows.',
   99, '/industry-pulse',
   ARRAY['Boiler Service','HVAC','Plumbing','Electrical','Roofing','General Contractor','Auto Manufacturing'],
   ARRAY[]::TEXT[], TRUE, 30),
  ('site_radar', 'Predictive Sales — Who''s on YOUR Site Right Now', 'SiteRadar',
   'Identify the company behind every visitor instantly. Surface the most likely decision-maker. Get an SMS when a hot account returns.',
   49, '/site-radar',
   ARRAY['Boiler Service','HVAC','Plumbing','Electrical','Roofing','General Contractor','Professional Services','Healthcare','Field Service (multi-trade)'],
   ARRAY[]::TEXT[], TRUE, 40),
  ('tech_alert', 'Predictive Hiring (license-gated trades only)', 'TechAlert / Talent Radar',
   'Get notified the moment a licensed tech in your trade becomes available — state licensing records + proprietary OSINT.',
   149, '/talent-radar',
   ARRAY['HVAC','Plumbing','Electrical'],
   ARRAY['Boiler Service','Mortgage Broker','Real Estate','Professional Services','Healthcare','Roofing','General Contractor','Auto Manufacturing','Field Service (multi-trade)'],
   TRUE, 50),
  ('mortgage_radar', 'Predictive Sales — Mortgage Lead Radar', 'Mortgage Radar',
   'FSBO listings, court records, and SOS filings — homeowner intent signals for licensed mortgage brokers.',
   149, '/mortgage-radar',
   ARRAY['Mortgage Broker','Real Estate'],
   ARRAY['Boiler Service','HVAC','Plumbing','Electrical','Roofing','General Contractor','Auto Manufacturing','Healthcare','Field Service (multi-trade)','Professional Services'],
   TRUE, 60),
  ('missed_call', 'Missed-Call Catch + Review Texts', 'Missed-Call Catch',
   'Auto-text every missed call within 60 seconds. Recovers ~38% of lost leads. Auto-asks happy customers for a Google review.',
   99, '/missed-call',
   ARRAY['Boiler Service','HVAC','Plumbing','Electrical','Roofing','General Contractor','Mortgage Broker','Real Estate','Auto Manufacturing','Healthcare','Field Service (multi-trade)','Professional Services'],
   ARRAY[]::TEXT[], FALSE, 200),
  ('field_desk', 'FieldDesk — Dispatch + GPS + Customer SMS', 'FieldDesk',
   '$199/mo flat for unlimited techs. Dispatch board, live GPS, auto-SMS to customers. Or run as a Marketing Layer on top of eWay.',
   199, '/field-service',
   ARRAY['Boiler Service','HVAC','Plumbing','Electrical','Roofing','General Contractor','Field Service (multi-trade)'],
   ARRAY['Mortgage Broker','Real Estate','Professional Services'], FALSE, 210)
ON CONFLICT (slug) DO NOTHING;