-- Phase 23 additions:
-- 1. missed_call_clients: add google_review_url + owner_phone
-- 2. missed_call_captures: lead capture from every missed DWA call
-- 3. callback_reminders: "call me at 3pm" scheduling
-- 4. client_nps_scores: NPS survey responses at 30/60/90 day marks
-- 5. Seed field_crm_clients for Matt's own two sites (DWA + M²)

-- ── missed_call_clients additions ───────────────────────────────────────────
ALTER TABLE public.missed_call_clients
  ADD COLUMN IF NOT EXISTS google_review_url TEXT,
  ADD COLUMN IF NOT EXISTS owner_phone        TEXT;

-- ── missed_call_captures ─────────────────────────────────────────────────────
-- One row per missed call to +13139921219. The DWA lead pipeline.
CREATE TABLE IF NOT EXISTS public.missed_call_captures (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  caller_number        TEXT        NOT NULL,
  city                 TEXT,
  voicemail_transcript TEXT,
  text_sent            TEXT,
  reply_received       TEXT,
  status               TEXT        NOT NULL DEFAULT 'new'
                       CHECK (status IN ('new','in_progress','resolved')),
  google_review_sent_at TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.missed_call_captures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role bypass missed_call_captures"
  ON public.missed_call_captures FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_mcc_caller ON public.missed_call_captures (caller_number, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mcc_status  ON public.missed_call_captures (status);

-- ── callback_reminders ───────────────────────────────────────────────────────
-- Parsed from "call me at X" replies; cron fires SMS to Matt when due.
CREATE TABLE IF NOT EXISTS public.callback_reminders (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  caller_number  TEXT        NOT NULL,
  context        TEXT,
  scheduled_for  TIMESTAMPTZ NOT NULL,
  status         TEXT        NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','sent','expired')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.callback_reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role bypass callback_reminders"
  ON public.callback_reminders FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_cr_pending ON public.callback_reminders (status, scheduled_for)
  WHERE status = 'pending';

-- ── client_nps_scores ────────────────────────────────────────────────────────
-- NPS survey responses at 30/60/90 day marks per product.
CREATE TABLE IF NOT EXISTS public.client_nps_scores (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_email TEXT        NOT NULL,
  product      TEXT        NOT NULL,
  score        INT         CHECK (score BETWEEN 1 AND 10),
  raw_reply    TEXT,
  milestone    INT         NOT NULL CHECK (milestone IN (30, 60, 90)),
  surveyed_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.client_nps_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role bypass client_nps_scores"
  ON public.client_nps_scores FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE UNIQUE INDEX IF NOT EXISTS idx_nps_unique_milestone
  ON public.client_nps_scores (client_email, product, milestone);

-- ── Seed: Matt's own sites in field_crm_clients for SiteRadar tracking ───────
-- detroitwebagent.com and mattmichelstraining.com each get their own script key
-- so Matt can monitor visitors to both properties from Visitor Intel.
INSERT INTO public.field_crm_clients
  (business_name, owner_name, email, website, industry, status, monthly_price)
VALUES
  ('Detroit Web Agency', 'Matt Michels', 'matt@detroitwebagent.com',
   'https://detroitwebagent.com', 'agency', 'active', 0),
  ('M² Performance Training', 'Matt Michels', 'matt@mattmichelstraining.com',
   'https://mattmichelstraining.com', 'fitness', 'active', 0)
ON CONFLICT (email) DO NOTHING;
