-- ────────────────────────────────────────────────────────────────────
-- Cold Email Engine v3 — Demand Heat Sniper foundation
-- ────────────────────────────────────────────────────────────────────

-- 1. buyer_contacts: cached decision-maker rows from 8-stage waterfall
CREATE TABLE IF NOT EXISTS public.buyer_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id uuid NOT NULL REFERENCES public.industrial_supply_buyers(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  first_name text,
  title text,
  seniority text,                  -- buyer | manager | director | vp | owner | gm
  email text,
  email_verified boolean DEFAULT false,
  email_source text,               -- apollo|snov|hunter|pdl|pattern|site_scrape|manual
  email_confidence integer DEFAULT 0 CHECK (email_confidence BETWEEN 0 AND 100),
  linkedin_url text,
  phone text,
  is_primary boolean DEFAULT false,
  enriched_at timestamptz,
  refreshed_at timestamptz,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,  -- enrichment_trace lives here
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_buyer_contacts_email
  ON public.buyer_contacts (buyer_id, lower(email)) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_buyer_contacts_buyer
  ON public.buyer_contacts (buyer_id, is_primary DESC, email_confidence DESC);

ALTER TABLE public.buyer_contacts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role full access bc" ON public.buyer_contacts;
CREATE POLICY "service_role full access bc" ON public.buyer_contacts
  FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "admins read bc" ON public.buyer_contacts;
CREATE POLICY "admins read bc" ON public.buyer_contacts
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 2. signal_buyer_intent: BIS cache (24h TTL enforced in app code)
CREATE TABLE IF NOT EXISTS public.signal_buyer_intent (
  signal_id uuid NOT NULL,
  buyer_id  uuid NOT NULL,
  contact_id uuid,
  bis numeric NOT NULL CHECK (bis >= 0 AND bis <= 100),
  breakdown jsonb NOT NULL,        -- { vertical, geo, spend_window, recency, seniority, deliverability, lift }
  computed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (signal_id, buyer_id, contact_id)
);
CREATE INDEX IF NOT EXISTS idx_sbi_signal_score
  ON public.signal_buyer_intent (signal_id, bis DESC);

ALTER TABLE public.signal_buyer_intent ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role full access sbi" ON public.signal_buyer_intent;
CREATE POLICY "service_role full access sbi" ON public.signal_buyer_intent
  FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "admins read sbi" ON public.signal_buyer_intent;
CREATE POLICY "admins read sbi" ON public.signal_buyer_intent
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 3. email_arm_stats: multi-armed bandit (subject × opener × CTA × vertical)
CREATE TABLE IF NOT EXISTS public.email_arm_stats (
  arm_key text NOT NULL,           -- "subj:name_drop_signal|open:curious|cta:50"
  vertical text NOT NULL,
  sent integer NOT NULL DEFAULT 0,
  opened integer NOT NULL DEFAULT 0,
  replied integer NOT NULL DEFAULT 0,
  bought integer NOT NULL DEFAULT 0,
  unsubscribed integer NOT NULL DEFAULT 0,
  bounced integer NOT NULL DEFAULT 0,
  last_updated timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (arm_key, vertical)
);
CREATE INDEX IF NOT EXISTS idx_eas_vertical
  ON public.email_arm_stats (vertical, replied DESC);

ALTER TABLE public.email_arm_stats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role full access eas" ON public.email_arm_stats;
CREATE POLICY "service_role full access eas" ON public.email_arm_stats
  FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "admins read eas" ON public.email_arm_stats;
CREATE POLICY "admins read eas" ON public.email_arm_stats
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 4. dossier_share_tokens: public share-page tokens
CREATE TABLE IF NOT EXISTS public.dossier_share_tokens (
  token text PRIMARY KEY,
  signal_id uuid NOT NULL,
  created_for_email text,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dst_signal ON public.dossier_share_tokens (signal_id);

ALTER TABLE public.dossier_share_tokens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role full access dst" ON public.dossier_share_tokens;
CREATE POLICY "service_role full access dst" ON public.dossier_share_tokens
  FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "admins read dst" ON public.dossier_share_tokens;
CREATE POLICY "admins read dst" ON public.dossier_share_tokens
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 5. dossier_share_views: anonymous view tracking
CREATE TABLE IF NOT EXISTS public.dossier_share_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL REFERENCES public.dossier_share_tokens(token) ON DELETE CASCADE,
  ip_hash text,
  user_agent text,
  dwell_seconds integer,
  viewed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dsv_token ON public.dossier_share_views (token, viewed_at DESC);

ALTER TABLE public.dossier_share_views ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role full access dsv" ON public.dossier_share_views;
CREATE POLICY "service_role full access dsv" ON public.dossier_share_views
  FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "admins read dsv" ON public.dossier_share_views;
CREATE POLICY "admins read dsv" ON public.dossier_share_views
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 6. dossier_pdf_cache: 24h signed-URL cache per signal
CREATE TABLE IF NOT EXISTS public.dossier_pdf_cache (
  signal_id uuid PRIMARY KEY,
  storage_path text NOT NULL,
  signed_url text NOT NULL,
  signed_url_expires_at timestamptz NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.dossier_pdf_cache ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role full access dpc" ON public.dossier_pdf_cache;
CREATE POLICY "service_role full access dpc" ON public.dossier_pdf_cache
  FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "admins read dpc" ON public.dossier_pdf_cache;
CREATE POLICY "admins read dpc" ON public.dossier_pdf_cache
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 7. city_coords: Haversine lookup cache (city, state) -> (lat, lng)
CREATE TABLE IF NOT EXISTS public.city_coords (
  city_state text PRIMARY KEY,     -- "detroit|MI"
  lat numeric NOT NULL,
  lng numeric NOT NULL,
  populated boolean NOT NULL DEFAULT false,
  populated_at timestamptz DEFAULT now()
);

ALTER TABLE public.city_coords ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role full access cc" ON public.city_coords;
CREATE POLICY "service_role full access cc" ON public.city_coords
  FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "admins read cc" ON public.city_coords;
CREATE POLICY "admins read cc" ON public.city_coords
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 8. email_quality_checks: 5-check pre-send audit per draft
CREATE TABLE IF NOT EXISTS public.email_quality_checks (
  draft_id uuid PRIMARY KEY,
  spam_score integer,
  mx_ok boolean,
  throttle_ok boolean,
  warmup_ok boolean,
  compliant boolean,
  decision text NOT NULL CHECK (decision IN ('pass','fail')),
  reason text,
  checked_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.email_quality_checks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role full access eqc" ON public.email_quality_checks;
CREATE POLICY "service_role full access eqc" ON public.email_quality_checks
  FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "admins read eqc" ON public.email_quality_checks;
CREATE POLICY "admins read eqc" ON public.email_quality_checks
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 9. Seed key Metro Detroit city coords so day-1 geo scoring works without a Google call
INSERT INTO public.city_coords (city_state, lat, lng, populated) VALUES
  ('detroit|MI',           42.3314, -83.0458, true),
  ('grosse pointe|MI',     42.3864, -82.9118, true),
  ('warren|MI',            42.5145, -83.0147, true),
  ('sterling heights|MI',  42.5803, -83.0302, true),
  ('troy|MI',              42.6064, -83.1498, true),
  ('royal oak|MI',         42.4894, -83.1446, true),
  ('southfield|MI',        42.4734, -83.2219, true),
  ('livonia|MI',           42.3684, -83.3527, true),
  ('dearborn|MI',          42.3223, -83.1763, true),
  ('ann arbor|MI',         42.2808, -83.7430, true),
  ('plymouth|MI',          42.3714, -83.4702, true),
  ('canton|MI',            42.3086, -83.4822, true),
  ('novi|MI',              42.4806, -83.4755, true),
  ('farmington hills|MI',  42.4989, -83.3677, true),
  ('rochester hills|MI',   42.6583, -83.1499, true),
  ('pontiac|MI',           42.6389, -83.2910, true),
  ('auburn hills|MI',      42.6875, -83.2341, true),
  ('madison heights|MI',   42.4858, -83.1052, true),
  ('clinton township|MI',  42.5870, -82.9201, true),
  ('macomb|MI',            42.6720, -82.9300, true),
  ('chesterfield|MI',      42.6712, -82.8366, true),
  ('flint|MI',             43.0125, -83.6875, true),
  ('lansing|MI',           42.7325, -84.5555, true),
  ('grand rapids|MI',      42.9634, -85.6681, true),
  ('toledo|OH',            41.6528, -83.5379, true)
ON CONFLICT (city_state) DO NOTHING;