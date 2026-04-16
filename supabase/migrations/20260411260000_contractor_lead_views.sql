-- contractor_lead_views: tracks when a contractor tries to buy a lead but it's already sold/locked
-- Used by contractor-fomo-mailer to identify contractors missing multiple leads

CREATE TABLE IF NOT EXISTS contractor_lead_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id uuid NOT NULL,
  lead_id uuid NOT NULL,
  reason text NOT NULL DEFAULT 'sold' CHECK (reason IN ('sold', 'locked')),
  trade text,
  city text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE contractor_lead_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON contractor_lead_views FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX idx_lead_views_contractor ON contractor_lead_views(contractor_id, created_at DESC);
CREATE INDEX idx_lead_views_created ON contractor_lead_views(created_at DESC);

-- pg_cron: contractor-fomo-mailer daily at 3pm ET (19:00 UTC)
SELECT cron.schedule(
  'contractor-fomo-mailer',
  '0 19 * * *',
  $$SELECT net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/contractor-fomo-mailer',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.service_role_key')),
    body := '{}'::jsonb
  )$$
);
