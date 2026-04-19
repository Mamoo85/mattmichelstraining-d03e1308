
-- 1. Backfill growth_radar_signals → industry_pulse_signals
INSERT INTO public.industry_pulse_signals (
  id, company_name, location, signal_type, county, vertical,
  predicted_needs, recommended_pitch, source_urls, confidence,
  detected_at, created_at, hiring_roles
)
SELECT
  g.id,
  g.company_name,
  g.county AS location,
  g.signal_type,
  g.county,
  g.vertical,
  COALESCE(g.predicted_needs, '{}'::text[]),
  g.recommended_pitch,
  CASE WHEN g.source_url IS NOT NULL THEN ARRAY[g.source_url] ELSE '{}'::text[] END,
  g.confidence,
  g.detected_at,
  g.created_at,
  '{}'::text[]
FROM public.growth_radar_signals g
WHERE NOT EXISTS (SELECT 1 FROM public.industry_pulse_signals i WHERE i.id = g.id);

-- 2. Drop the duplicate tables (clients is empty, signals already backfilled)
DROP TABLE IF EXISTS public.growth_radar_signals CASCADE;
DROP TABLE IF EXISTS public.growth_radar_clients CASCADE;

-- 3. Recreate as compatibility views over the canonical tables
CREATE OR REPLACE VIEW public.growth_radar_signals AS
SELECT
  id,
  COALESCE((source_urls)[1], '') AS source,
  signal_type,
  company_name,
  county,
  vertical,
  NULL::numeric AS value_usd,
  predicted_needs,
  recommended_pitch,
  COALESCE((source_urls)[1], NULL) AS source_url,
  confidence,
  detected_at,
  NULL::timestamptz AS expires_at,
  '{}'::jsonb AS metadata,
  created_at
FROM public.industry_pulse_signals;

CREATE OR REPLACE VIEW public.growth_radar_clients AS
SELECT
  id,
  email,
  company_name AS business_name,
  contact_name,
  phone,
  territory_counties AS county_filter,
  COALESCE(target_industries, ARRAY['all'::text]) AS vertical_filter,
  COALESCE(active, false) AS active,
  stripe_customer_id,
  stripe_subscription_id,
  created_at,
  updated_at
FROM public.industry_pulse_clients;

-- 4. INSTEAD OF triggers so writers using the legacy names keep working
CREATE OR REPLACE FUNCTION public.growth_radar_signals_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.industry_pulse_signals (
    id, company_name, location, signal_type, county, vertical,
    predicted_needs, recommended_pitch, source_urls, confidence,
    detected_at, created_at, hiring_roles
  ) VALUES (
    COALESCE(NEW.id, gen_random_uuid()),
    NEW.company_name,
    NEW.county,
    NEW.signal_type,
    NEW.county,
    NEW.vertical,
    COALESCE(NEW.predicted_needs, '{}'::text[]),
    NEW.recommended_pitch,
    CASE WHEN NEW.source_url IS NOT NULL THEN ARRAY[NEW.source_url] ELSE '{}'::text[] END,
    COALESCE(NEW.confidence, 5),
    COALESCE(NEW.detected_at, now()),
    COALESCE(NEW.created_at, now()),
    '{}'::text[]
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER growth_radar_signals_insert_trg
  INSTEAD OF INSERT ON public.growth_radar_signals
  FOR EACH ROW EXECUTE FUNCTION public.growth_radar_signals_insert();

CREATE OR REPLACE FUNCTION public.growth_radar_clients_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.industry_pulse_clients (
    id, email, company_name, contact_name, phone,
    territory_counties, target_industries, active,
    stripe_customer_id, stripe_subscription_id, created_at, updated_at
  ) VALUES (
    COALESCE(NEW.id, gen_random_uuid()),
    NEW.email,
    NEW.business_name,
    NEW.contact_name,
    NEW.phone,
    COALESCE(NEW.county_filter, ARRAY['all_michigan'::text]),
    COALESCE(NEW.vertical_filter, ARRAY['all'::text]),
    COALESCE(NEW.active, false),
    NEW.stripe_customer_id,
    NEW.stripe_subscription_id,
    COALESCE(NEW.created_at, now()),
    COALESCE(NEW.updated_at, now())
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER growth_radar_clients_insert_trg
  INSTEAD OF INSERT ON public.growth_radar_clients
  FOR EACH ROW EXECUTE FUNCTION public.growth_radar_clients_insert();
