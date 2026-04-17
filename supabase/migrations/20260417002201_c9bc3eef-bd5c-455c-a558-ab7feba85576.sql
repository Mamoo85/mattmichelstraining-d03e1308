-- Phase 2/3: Demand Radar production-ready + multi-vertical buyer support

-- 1. Extend industry_pulse_clients to support multiple buyer types (recruiters, suppliers, contractors)
ALTER TABLE public.industry_pulse_clients
  ADD COLUMN IF NOT EXISTS buyer_type text NOT NULL DEFAULT 'supplier',
  ADD COLUMN IF NOT EXISTS vertical text,
  ADD COLUMN IF NOT EXISTS territory_counties text[] DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS webhook_url text,
  ADD COLUMN IF NOT EXISTS is_test_account boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_alerted_at timestamptz,
  ADD COLUMN IF NOT EXISTS plan text DEFAULT 'standard';

COMMENT ON COLUMN public.industry_pulse_clients.buyer_type IS 'recruiter | supplier | contractor — drives signal routing and pitch templates';
COMMENT ON COLUMN public.industry_pulse_clients.vertical IS 'steel | plumbing_supply | roofing_supply | hvac_supply | electrical_supply | concrete | lumber | industrial_general';

CREATE INDEX IF NOT EXISTS idx_ipc_active_buyer ON public.industry_pulse_clients (active, buyer_type) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_ipc_vertical ON public.industry_pulse_clients (vertical) WHERE active = true;

-- 2. Extend industry_pulse_signals with vertical + buyer routing
ALTER TABLE public.industry_pulse_signals
  ADD COLUMN IF NOT EXISTS vertical text,
  ADD COLUMN IF NOT EXISTS target_buyer_type text DEFAULT 'recruiter',
  ADD COLUMN IF NOT EXISTS county text,
  ADD COLUMN IF NOT EXISTS expansion_type text;

CREATE INDEX IF NOT EXISTS idx_ips_vertical_county ON public.industry_pulse_signals (vertical, county, detected_at DESC) WHERE confidence >= 7;
CREATE INDEX IF NOT EXISTS idx_ips_target_buyer ON public.industry_pulse_signals (target_buyer_type, detected_at DESC);

-- 3. Track contact actions on signals (for buyer portal "Mark Contacted")
CREATE TABLE IF NOT EXISTS public.demand_radar_signal_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_id uuid NOT NULL REFERENCES public.industry_pulse_signals(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.industry_pulse_clients(id) ON DELETE CASCADE,
  action text NOT NULL DEFAULT 'contacted',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (signal_id, client_id, action)
);

ALTER TABLE public.demand_radar_signal_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on demand_radar_signal_actions"
  ON public.demand_radar_signal_actions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_drsa_client ON public.demand_radar_signal_actions (client_id, created_at DESC);

-- 4. Schedule industrial-growth-intel daily at 6am ET (10:00 UTC) — gated in-function by subscriber count
SELECT cron.unschedule('industrial-growth-intel-daily') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'industrial-growth-intel-daily'
);

SELECT cron.schedule(
  'industrial-growth-intel-daily',
  '0 10 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/industrial-growth-intel',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')
    ),
    body := jsonb_build_object('trigger', 'cron', 'persist', true)
  );
  $$
);

-- 5. Schedule demand-radar daily email digest at 7am ET (11:00 UTC)
SELECT cron.unschedule('demand-radar-digest-daily') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'demand-radar-digest-daily'
);

SELECT cron.schedule(
  'demand-radar-digest-daily',
  '0 11 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/demand-radar-digest',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')
    ),
    body := '{}'::jsonb
  );
  $$
);