-- ============================================================
-- DEMAND RADAR COMMAND CENTER — SPRINT 1 BACKBONE
-- ============================================================

-- 1. Geocoding columns on signals
ALTER TABLE public.industry_pulse_signals
  ADD COLUMN IF NOT EXISTS lat double precision,
  ADD COLUMN IF NOT EXISTS lng double precision,
  ADD COLUMN IF NOT EXISTS geocoded_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_ips_geocoded
  ON public.industry_pulse_signals (geocoded_at)
  WHERE lat IS NOT NULL AND lng IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ips_pending_geocode
  ON public.industry_pulse_signals (detected_at DESC)
  WHERE lat IS NULL AND location IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ips_geo_bbox
  ON public.industry_pulse_signals (lng, lat, detected_at DESC)
  WHERE lat IS NOT NULL AND lng IS NOT NULL;

-- 2. Intent score snapshots (the predictive engine output)
CREATE TABLE IF NOT EXISTS public.intent_score_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_key text NOT NULL,
  company_name text,
  location text,
  vertical text,
  computed_at timestamptz NOT NULL DEFAULT now(),
  score numeric(5,2) NOT NULL,
  signal_count int NOT NULL DEFAULT 0,
  category_count int NOT NULL DEFAULT 0,
  stacking_multiplier numeric(4,2) NOT NULL DEFAULT 1.0,
  tier text NOT NULL,
  trajectory_delta_7d numeric(5,2),
  trajectory_delta_14d numeric(5,2),
  contributing_signals jsonb NOT NULL DEFAULT '[]'::jsonb,
  lat double precision,
  lng double precision,
  is_surging boolean NOT NULL DEFAULT false,
  is_at_risk boolean NOT NULL DEFAULT false,
  is_budget_released boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_iss_account_recent
  ON public.intent_score_snapshots (account_key, computed_at DESC);

CREATE INDEX IF NOT EXISTS idx_iss_score_recent
  ON public.intent_score_snapshots (computed_at DESC, score DESC);

CREATE INDEX IF NOT EXISTS idx_iss_surging
  ON public.intent_score_snapshots (computed_at DESC, score DESC)
  WHERE is_surging = true;

CREATE INDEX IF NOT EXISTS idx_iss_at_risk
  ON public.intent_score_snapshots (computed_at DESC)
  WHERE is_at_risk = true;

CREATE INDEX IF NOT EXISTS idx_iss_budget
  ON public.intent_score_snapshots (computed_at DESC, score DESC)
  WHERE is_budget_released = true;

ALTER TABLE public.intent_score_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "intent_score_snapshots_service_role_all"
  ON public.intent_score_snapshots FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "intent_score_snapshots_admin_select"
  ON public.intent_score_snapshots FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 3. Signal weights config (default + per-user overrides)
CREATE TABLE IF NOT EXISTS public.signal_weights_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  signal_type text NOT NULL,
  weight int NOT NULL CHECK (weight >= 0 AND weight <= 100),
  half_life_days int NOT NULL CHECK (half_life_days > 0),
  category text NOT NULL,
  display_label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, signal_type)
);

CREATE INDEX IF NOT EXISTS idx_swc_user
  ON public.signal_weights_config (user_id, signal_type);

ALTER TABLE public.signal_weights_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "swc_service_role_all"
  ON public.signal_weights_config FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "swc_admin_all"
  ON public.signal_weights_config FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "swc_user_own"
  ON public.signal_weights_config FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Seed default weights (user_id = NULL means global default)
INSERT INTO public.signal_weights_config (user_id, signal_type, weight, half_life_days, category, display_label)
VALUES
  (NULL, 'llc_filing',         35, 60,  'birth',      'New LLC formed (MI SOS)'),
  (NULL, 'new_business_entity',35, 60,  'birth',      'New business entity'),
  (NULL, 'permit_new',         30, 45,  'expansion',  'New permit pulled'),
  (NULL, 'permit_surge',       30, 45,  'expansion',  'Permit surge in area'),
  (NULL, 'expansion',          30, 45,  'expansion',  'Expansion announcement'),
  (NULL, 'hiring',             25, 21,  'growth',     'Active hiring'),
  (NULL, 'hiring_burst',       25, 21,  'growth',     'Hiring burst'),
  (NULL, 'job_posting',        10, 14,  'growth',     'Job posting'),
  (NULL, 'rfp',                40, 90,  'budget',     'RFP issued'),
  (NULL, 'rfp_award',          40, 90,  'budget',     'RFP award'),
  (NULL, 'contract_award',     40, 90,  'budget',     'Contract awarded'),
  (NULL, 'sba_loan',           35, 120, 'budget',     'SBA loan approved'),
  (NULL, 'rd_grant',           35, 120, 'budget',     'R&D grant'),
  (NULL, 'investment',         35, 120, 'budget',     'Investment received'),
  (NULL, 'license_new',        20, 180, 'compliance', 'New license issued'),
  (NULL, 'sam_gov_award',      40, 90,  'budget',     'SAM.gov contract'),
  (NULL, 'school_rfp',         40, 90,  'budget',     'School district RFP'),
  (NULL, 'trademark_filing',   25, 90,  'expansion',  'Trademark filing'),
  (NULL, 'domain_registered',  15, 30,  'birth',      'Domain registered'),
  (NULL, 'court_filing',       20, 60,  'risk',       'Court filing'),
  (NULL, 'demand_signal',      30, 45,  'expansion',  'Demand signal')
ON CONFLICT (user_id, signal_type) DO NOTHING;

-- 4. Account narratives (cached AI summaries)
CREATE TABLE IF NOT EXISTS public.account_narratives (
  account_key text PRIMARY KEY,
  narrative_md text NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now(),
  model text NOT NULL DEFAULT 'google/gemini-3-flash-preview',
  pitch_angle text,
  recommended_products text[],
  signals_snapshot_at timestamptz,
  cost_cents numeric(8,4) DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_an_generated
  ON public.account_narratives (generated_at DESC);

ALTER TABLE public.account_narratives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "an_service_role_all"
  ON public.account_narratives FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "an_admin_select"
  ON public.account_narratives FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 5. Pinned accounts (collaboration)
CREATE TABLE IF NOT EXISTS public.pinned_accounts (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_key text NOT NULL,
  pinned_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  PRIMARY KEY (user_id, account_key)
);

CREATE INDEX IF NOT EXISTS idx_pa_user_recent
  ON public.pinned_accounts (user_id, pinned_at DESC);

ALTER TABLE public.pinned_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pa_service_role_all"
  ON public.pinned_accounts FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "pa_user_own"
  ON public.pinned_accounts FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 6. Account notes (visible to team)
CREATE TABLE IF NOT EXISTS public.account_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_key text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_owner_id uuid,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_an_account_recent
  ON public.account_notes (account_key, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_an_team
  ON public.account_notes (team_owner_id, created_at DESC);

ALTER TABLE public.account_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "an_notes_service_role_all"
  ON public.account_notes FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "an_notes_user_own"
  ON public.account_notes FOR ALL
  USING (auth.uid() = user_id OR auth.uid() = team_owner_id)
  WITH CHECK (auth.uid() = user_id);

-- 7. Demand Radar seats (multi-seat collaboration for Command tier)
CREATE TABLE IF NOT EXISTS public.demand_radar_seats (
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner','admin','member','viewer')),
  invited_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  PRIMARY KEY (owner_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_drs_member ON public.demand_radar_seats (member_id);

ALTER TABLE public.demand_radar_seats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "drs_service_role_all"
  ON public.demand_radar_seats FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "drs_owner_manage"
  ON public.demand_radar_seats FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "drs_member_read"
  ON public.demand_radar_seats FOR SELECT
  USING (auth.uid() = member_id);

-- 8. Account share links (signed read-only URLs)
CREATE TABLE IF NOT EXISTS public.account_share_links (
  token text PRIMARY KEY,
  account_key text NOT NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  view_count int NOT NULL DEFAULT 0,
  last_viewed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_asl_creator ON public.account_share_links (created_by, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_asl_expires ON public.account_share_links (expires_at);

ALTER TABLE public.account_share_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "asl_service_role_all"
  ON public.account_share_links FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "asl_owner_manage"
  ON public.account_share_links FOR ALL
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

-- 9. Subscription migrations audit (Industry Pulse → Demand Radar upgrade)
CREATE TABLE IF NOT EXISTS public.subscription_migrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  email text,
  stripe_customer_id text,
  old_product text NOT NULL,
  new_product text NOT NULL,
  old_price_cents int,
  new_price_cents int,
  free_through timestamptz,
  reason text,
  migrated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sm_user ON public.subscription_migrations (user_id);
CREATE INDEX IF NOT EXISTS idx_sm_recent ON public.subscription_migrations (migrated_at DESC);

ALTER TABLE public.subscription_migrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sm_service_role_all"
  ON public.subscription_migrations FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "sm_admin_select"
  ON public.subscription_migrations FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 10. User onboarding state (so welcome modal fires once)
CREATE TABLE IF NOT EXISTS public.user_onboarding_state (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  demand_radar_welcomed_at timestamptz,
  demand_radar_tour_completed_at timestamptz,
  state jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_onboarding_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "uos_service_role_all"
  ON public.user_onboarding_state FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "uos_user_own"
  ON public.user_onboarding_state FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 11. Helper: stable account key generator
CREATE OR REPLACE FUNCTION public.demand_radar_account_key(p_company text, p_location text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(regexp_replace(coalesce(p_company,'unknown'), '[^a-z0-9]+', '', 'gi'))
      || '|' ||
      lower(regexp_replace(coalesce(p_location,''), '[^a-z0-9]+', '', 'gi'));
$$;

-- 12. Latest snapshot per account (the table the UI reads from)
CREATE OR REPLACE VIEW public.v_latest_intent_scores
WITH (security_invoker = true)
AS
SELECT DISTINCT ON (account_key)
  account_key,
  company_name,
  location,
  vertical,
  computed_at,
  score,
  signal_count,
  category_count,
  stacking_multiplier,
  tier,
  trajectory_delta_7d,
  trajectory_delta_14d,
  contributing_signals,
  lat,
  lng,
  is_surging,
  is_at_risk,
  is_budget_released
FROM public.intent_score_snapshots
ORDER BY account_key, computed_at DESC;

GRANT SELECT ON public.v_latest_intent_scores TO authenticated, anon, service_role;