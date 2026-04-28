
-- 1. Additive columns on contractor_outreach_prospects
ALTER TABLE public.contractor_outreach_prospects
  ADD COLUMN IF NOT EXISTS consent_for_email boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS consent_email_source text,
  ADD COLUMN IF NOT EXISTS consent_email_timestamp timestamptz,
  ADD COLUMN IF NOT EXISTS quality_score smallint,
  ADD COLUMN IF NOT EXISTS quality_breakdown jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS territory_priority smallint NOT NULL DEFAULT 3
    CHECK (territory_priority BETWEEN 1 AND 3);

CREATE INDEX IF NOT EXISTS idx_outreach_prospects_quality
  ON public.contractor_outreach_prospects (quality_score DESC NULLS LAST)
  WHERE unsubscribed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_outreach_prospects_territory
  ON public.contractor_outreach_prospects (territory_priority, trade);

-- 2. Quality score function
CREATE OR REPLACE FUNCTION public.compute_prospect_quality_score(_prospect_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p RECORD;
  email_pts smallint := 0;
  enrich_pts smallint := 0;
  terr_pts smallint := 0;
  top_conf numeric := 0;
  trace_elem jsonb;
BEGIN
  SELECT email, email_verified, enrichment_trace, territory_priority
    INTO p
  FROM public.contractor_outreach_prospects
  WHERE id = _prospect_id;

  IF NOT FOUND THEN RETURN; END IF;

  -- email validity (40)
  IF p.email_verified THEN email_pts := 40;
  ELSIF p.email IS NOT NULL AND p.email <> '' THEN email_pts := 20;
  END IF;

  -- enrichment confidence (30) — pull max confidence from trace
  IF p.enrichment_trace IS NOT NULL AND jsonb_typeof(p.enrichment_trace) = 'array' THEN
    FOR trace_elem IN SELECT * FROM jsonb_array_elements(p.enrichment_trace) LOOP
      IF (trace_elem->>'confidence') IS NOT NULL THEN
        top_conf := GREATEST(top_conf, (trace_elem->>'confidence')::numeric);
      END IF;
    END LOOP;
  END IF;
  enrich_pts := LEAST(30, ROUND(top_conf * 30))::smallint;

  -- territory match (30)
  terr_pts := CASE p.territory_priority WHEN 1 THEN 30 WHEN 2 THEN 20 ELSE 10 END;

  UPDATE public.contractor_outreach_prospects
     SET quality_score = email_pts + enrich_pts + terr_pts,
         quality_breakdown = jsonb_build_object(
           'email_validity', email_pts,
           'enrichment_confidence', enrich_pts,
           'territory_match', terr_pts,
           'top_enrichment_confidence', top_conf
         )
   WHERE id = _prospect_id;
END;
$$;

-- 3. Trigger to auto-recompute on relevant changes
CREATE OR REPLACE FUNCTION public.trg_recompute_prospect_quality()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM public.compute_prospect_quality_score(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prospects_quality_recompute ON public.contractor_outreach_prospects;
CREATE TRIGGER prospects_quality_recompute
AFTER INSERT OR UPDATE OF email, email_verified, enrichment_trace, territory_priority
ON public.contractor_outreach_prospects
FOR EACH ROW
EXECUTE FUNCTION public.trg_recompute_prospect_quality();

-- 4. Backfill existing rows
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.contractor_outreach_prospects WHERE quality_score IS NULL LOOP
    PERFORM public.compute_prospect_quality_score(r.id);
  END LOOP;
END $$;

-- 5. Global outreach settings (single row)
CREATE TABLE IF NOT EXISTS public.outreach_global_settings (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  cold_email_enabled boolean NOT NULL DEFAULT true,
  cold_sms_enabled boolean NOT NULL DEFAULT false,
  min_quality_score_to_send smallint NOT NULL DEFAULT 50,
  hide_demo_leads_below_score smallint NOT NULL DEFAULT 60,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.outreach_global_settings (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.outreach_global_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins manage global outreach settings" ON public.outreach_global_settings;
CREATE POLICY "admins manage global outreach settings"
  ON public.outreach_global_settings
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "service_role full access global outreach settings" ON public.outreach_global_settings;
CREATE POLICY "service_role full access global outreach settings"
  ON public.outreach_global_settings
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
