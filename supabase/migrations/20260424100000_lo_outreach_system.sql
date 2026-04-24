-- 20260424100000_lo_outreach_system.sql
-- Loan Officer targeting + multi-channel outreach infrastructure.
-- Additive only — does NOT modify any existing scanner tables.

-- =====================================================================
-- marketplace_prospects
-- LOs we want to sell leads to (sourced from NMLS + manual entry).
-- Separate from mortgage_radar_clients (paying subscribers).
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.marketplace_prospects (
  id                    UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nmls_id               TEXT        UNIQUE,
  full_name             TEXT        NOT NULL,
  company_name          TEXT,
  email                 TEXT,
  phone                 TEXT,
  fax_number            TEXT,
  mailing_address       JSONB,         -- { street, city, state, zip }
  enrichment_source     TEXT,          -- "apollo" | "sonar" | "nmls" | "manual"
  enriched_at           TIMESTAMPTZ,
  last_outreach_at      TIMESTAMPTZ,
  last_outreach_channel TEXT,
  opt_out_fax           BOOLEAN     DEFAULT FALSE,
  opt_out_email         BOOLEAN     DEFAULT FALSE,
  prospect_rank         INTEGER     DEFAULT 50,   -- 1=top, 100=low
  warmth_score          INTEGER     DEFAULT 0,    -- 0-10 composite
  notes                 TEXT,
  status                TEXT        DEFAULT 'active'
                          CHECK (status IN ('active', 'cold', 'converted', 'opted_out')),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_marketplace_prospects_status
  ON public.marketplace_prospects (status)
  WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_marketplace_prospects_warmth
  ON public.marketplace_prospects (warmth_score DESC);
CREATE INDEX IF NOT EXISTS idx_marketplace_prospects_nmls
  ON public.marketplace_prospects (nmls_id)
  WHERE nmls_id IS NOT NULL;

ALTER TABLE public.marketplace_prospects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_marketplace_prospects"
  ON public.marketplace_prospects FOR ALL TO service_role
  USING (true) WITH CHECK (true);
CREATE POLICY "admins_read_marketplace_prospects"
  ON public.marketplace_prospects FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- =====================================================================
-- lo_outreach_campaigns
-- One row per blast session Matt fires from the admin panel.
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.lo_outreach_campaigns (
  id                  UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  channel             TEXT        NOT NULL CHECK (channel IN ('email', 'fax', 'postcard')),
  lead_ids            UUID[]      DEFAULT ARRAY[]::UUID[],
  lead_signal_types   TEXT[]      DEFAULT ARRAY[]::TEXT[],
  prospect_count      INTEGER     DEFAULT 0,
  sent_count          INTEGER     DEFAULT 0,
  response_count      INTEGER     DEFAULT 0,
  total_cost_cents    INTEGER     DEFAULT 0,
  status              TEXT        DEFAULT 'queued'
                        CHECK (status IN ('queued', 'sending', 'complete', 'failed')),
  message_variant     TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at        TIMESTAMPTZ
);

ALTER TABLE public.lo_outreach_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_lo_outreach_campaigns"
  ON public.lo_outreach_campaigns FOR ALL TO service_role
  USING (true) WITH CHECK (true);
CREATE POLICY "admins_read_lo_outreach_campaigns"
  ON public.lo_outreach_campaigns FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- =====================================================================
-- lo_outreach_sends
-- One row per prospect per campaign send.
-- Used for cooldown checks (no send to same prospect within 7 days).
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.lo_outreach_sends (
  id                UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id       UUID        REFERENCES public.lo_outreach_campaigns(id) ON DELETE SET NULL,
  prospect_id       UUID        REFERENCES public.marketplace_prospects(id) ON DELETE CASCADE,
  channel           TEXT        NOT NULL,
  sent_at           TIMESTAMPTZ DEFAULT now(),
  delivered         BOOLEAN     DEFAULT FALSE,
  response_received BOOLEAN     DEFAULT FALSE,
  response_at       TIMESTAMPTZ,
  external_id       TEXT,       -- Lob id / Twilio Fax SID / Resend message id
  cost_cents        INTEGER     DEFAULT 0,
  error_msg         TEXT
);

CREATE INDEX IF NOT EXISTS idx_lo_outreach_sends_campaign
  ON public.lo_outreach_sends (campaign_id);
CREATE INDEX IF NOT EXISTS idx_lo_outreach_sends_prospect
  ON public.lo_outreach_sends (prospect_id, sent_at DESC);

ALTER TABLE public.lo_outreach_sends ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_lo_outreach_sends"
  ON public.lo_outreach_sends FOR ALL TO service_role
  USING (true) WITH CHECK (true);
CREATE POLICY "admins_read_lo_outreach_sends"
  ON public.lo_outreach_sends FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
