ALTER TABLE public.mortgage_radar_leads
  ADD COLUMN IF NOT EXISTS free_enrichment JSONB,
  ADD COLUMN IF NOT EXISTS free_enrich_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS lon DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS county TEXT;

CREATE INDEX IF NOT EXISTS idx_mortgage_radar_leads_free_enrich_at
  ON public.mortgage_radar_leads (free_enrich_at) WHERE free_enrich_at IS NULL;

SELECT cron.schedule(
  'marketplace-lead-free-enrich-hourly',
  '7 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url') || '/functions/v1/marketplace-lead-free-enrich-batch',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key'))
  );
  $$
);