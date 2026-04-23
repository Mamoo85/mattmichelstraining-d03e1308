-- Mortgage Radar enrich queue + pipeline stage
CREATE TABLE IF NOT EXISTS public.mortgage_radar_enrich_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.mortgage_radar_leads(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INT NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  UNIQUE(lead_id)
);

ALTER TABLE public.mortgage_radar_enrich_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_mortgage_radar_enrich_queue"
ON public.mortgage_radar_enrich_queue FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_mortgage_radar_enrich_queue_pending
ON public.mortgage_radar_enrich_queue(status, created_at)
WHERE status = 'pending';

-- Pipeline kanban stage on leads
ALTER TABLE public.mortgage_radar_leads
  ADD COLUMN IF NOT EXISTS pipeline_stage TEXT NOT NULL DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS street_view_url TEXT,
  ADD COLUMN IF NOT EXISTS estimated_equity TEXT,
  ADD COLUMN IF NOT EXISTS intel_highlights JSONB;

-- Cron for drain (every 10 min)
SELECT cron.schedule(
  'mortgage-radar-enrich-drain',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url:=(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url') || '/functions/v1/mortgage-radar-enrich-drain',
    headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')),
    body:='{}'::jsonb
  );
  $$
);

-- AM digest cron (6:30am ET = 11:30 UTC during EDT, 10:30 UTC during EST — use 11:30 UTC year-round, close enough)
SELECT cron.schedule(
  'mortgage-radar-am-digest',
  '30 11 * * *',
  $$
  SELECT net.http_post(
    url:=(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url') || '/functions/v1/mortgage-radar-am-digest',
    headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')),
    body:='{}'::jsonb
  );
  $$
);