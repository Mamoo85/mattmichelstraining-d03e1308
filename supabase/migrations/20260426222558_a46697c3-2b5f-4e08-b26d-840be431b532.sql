CREATE TABLE public.lead_enrichment_audit (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL,
  vertical TEXT NOT NULL CHECK (vertical IN ('mortgage','talent','demand','supply','growth','contractor','prospect','visitor','other')),
  function_name TEXT NOT NULL,
  stage TEXT NOT NULL CHECK (stage IN ('free','paid','gov','equity','deep','score','summarize','verify','other')),
  provider TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  duration_ms INTEGER,
  success BOOLEAN NOT NULL DEFAULT false,
  http_status INTEGER,
  error_code TEXT,
  error_message TEXT,
  fields_added TEXT[] DEFAULT '{}',
  cost_cents INTEGER DEFAULT 0,
  raw_response JSONB,
  triggered_by TEXT NOT NULL DEFAULT 'system' CHECK (triggered_by IN ('cron','webhook','manual','on_demand','buyer_view','system')),
  actor TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_lea_lead_id ON public.lead_enrichment_audit (lead_id, created_at DESC);
CREATE INDEX idx_lea_vertical_created ON public.lead_enrichment_audit (vertical, created_at DESC);
CREATE INDEX idx_lea_provider_success ON public.lead_enrichment_audit (provider, success, created_at DESC);
CREATE INDEX idx_lea_function_created ON public.lead_enrichment_audit (function_name, created_at DESC);
CREATE INDEX idx_lea_failures ON public.lead_enrichment_audit (created_at DESC) WHERE success = false;

ALTER TABLE public.lead_enrichment_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_lea"
  ON public.lead_enrichment_audit
  TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "admin_read_lea"
  ON public.lead_enrichment_audit FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "buyer_read_purchased_lead_audit"
  ON public.lead_enrichment_audit FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.marketplace_lead_locks mll
      WHERE mll.lead_id = lead_enrichment_audit.lead_id
        AND mll.status IN ('claimed','sold')
        AND lower(mll.buyer_email) = lower(coalesce((auth.jwt() ->> 'email'), ''))
    )
  );

CREATE OR REPLACE VIEW public.lead_enrichment_audit_buyer_view
WITH (security_invoker = true) AS
SELECT
  id, lead_id, vertical, function_name, stage, provider, finished_at, success
FROM public.lead_enrichment_audit;

GRANT SELECT ON public.lead_enrichment_audit_buyer_view TO authenticated, anon;

CREATE TABLE public.marketplace_inventory_status (
  vertical TEXT NOT NULL PRIMARY KEY CHECK (vertical IN ('mortgage','talent','demand','supply','growth')),
  available_count INTEGER NOT NULL DEFAULT 0,
  sold_24h INTEGER NOT NULL DEFAULT 0,
  hot_count INTEGER NOT NULL DEFAULT 0,
  is_visible BOOLEAN NOT NULL DEFAULT true,
  min_visible_threshold INTEGER NOT NULL DEFAULT 10,
  last_refreshed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.marketplace_inventory_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_mis"
  ON public.marketplace_inventory_status FOR SELECT
  TO anon, authenticated USING (true);

CREATE POLICY "service_role_all_mis"
  ON public.marketplace_inventory_status
  TO service_role USING (true) WITH CHECK (true);

INSERT INTO public.marketplace_inventory_status (vertical, available_count, is_visible, min_visible_threshold)
VALUES
  ('mortgage', 0, true, 10),
  ('talent',   0, true, 10),
  ('supply',   0, true, 10),
  ('demand',   0, true, 10),
  ('growth',   0, true, 10)
ON CONFLICT (vertical) DO NOTHING;