-- Per-company radar profile + fit cache + action log
ALTER TABLE public.industry_pulse_clients
  ADD COLUMN IF NOT EXISTS offering_summary text,
  ADD COLUMN IF NOT EXISTS avg_deal_size_usd integer,
  ADD COLUMN IF NOT EXISTS close_rate_pct integer DEFAULT 15,
  ADD COLUMN IF NOT EXISTS target_buyer_titles text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS differentiators text,
  ADD COLUMN IF NOT EXISTS service_radius_miles integer DEFAULT 50,
  ADD COLUMN IF NOT EXISTS sender_name text,
  ADD COLUMN IF NOT EXISTS sender_phone text,
  ADD COLUMN IF NOT EXISTS sender_email text;

-- Per-(signal, client) AI-cached fit explanation + revenue band
CREATE TABLE IF NOT EXISTS public.radar_lead_fit_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_id text NOT NULL,
  client_id uuid NOT NULL,
  radar text NOT NULL,                 -- 'demand' | 'buyer'
  fit_score smallint,                  -- 0..100
  fit_reason text,
  revenue_low_usd integer,
  revenue_high_usd integer,
  revenue_logic text,
  urgency_window_days smallint,
  suggested_opener text,
  objection_to_expect text,
  next_best_action text,               -- 'call' | 'email' | 'linkedin'
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS radar_lead_fit_cache_uniq
  ON public.radar_lead_fit_cache (signal_id, client_id, radar);

ALTER TABLE public.radar_lead_fit_cache ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS radar_lead_fit_cache_service ON public.radar_lead_fit_cache;
CREATE POLICY radar_lead_fit_cache_service ON public.radar_lead_fit_cache
  FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS radar_lead_fit_cache_anon_read ON public.radar_lead_fit_cache;
CREATE POLICY radar_lead_fit_cache_anon_read ON public.radar_lead_fit_cache
  FOR SELECT TO anon, authenticated USING (true);

-- Action log: client clicks "called", "emailed", etc.
CREATE TABLE IF NOT EXISTS public.radar_lead_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_id text NOT NULL,
  client_id uuid NOT NULL,
  radar text NOT NULL,
  action text NOT NULL,                -- 'called'|'emailed'|'linkedin'|'sms'|'crm'|'won'|'lost'|'snooze'
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS radar_lead_actions_lookup
  ON public.radar_lead_actions (client_id, signal_id, created_at DESC);

ALTER TABLE public.radar_lead_actions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS radar_lead_actions_service ON public.radar_lead_actions;
CREATE POLICY radar_lead_actions_service ON public.radar_lead_actions
  FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS radar_lead_actions_anon_read ON public.radar_lead_actions;
CREATE POLICY radar_lead_actions_anon_read ON public.radar_lead_actions
  FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS radar_lead_actions_anon_insert ON public.radar_lead_actions;
CREATE POLICY radar_lead_actions_anon_insert ON public.radar_lead_actions
  FOR INSERT TO anon, authenticated WITH CHECK (true);