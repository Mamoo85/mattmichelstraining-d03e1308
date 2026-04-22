
-- Channel 3: Industrial Pulse free newsletter subscribers (separate from existing newsletter_subscribers which is M2 fitness)
CREATE TABLE IF NOT EXISTS public.industrial_pulse_subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  business_name TEXT,
  vertical_interest TEXT,
  source TEXT DEFAULT 'industrial-pulse-page',
  confirmed BOOLEAN NOT NULL DEFAULT true,
  unsubscribed BOOLEAN NOT NULL DEFAULT false,
  unsubscribed_at TIMESTAMPTZ,
  last_sent_at TIMESTAMPTZ,
  send_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_industrial_pulse_active ON public.industrial_pulse_subscribers(unsubscribed) WHERE unsubscribed = false;

ALTER TABLE public.industrial_pulse_subscribers ENABLE ROW LEVEL SECURITY;

-- Service role full access (edge functions)
CREATE POLICY "service_role_all_industrial_pulse_subs" ON public.industrial_pulse_subscribers
  AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Allow public anonymous signup (insert only) — public newsletter signup form
CREATE POLICY "public_can_subscribe_industrial_pulse" ON public.industrial_pulse_subscribers
  AS PERMISSIVE FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- Channel 1: Track sent dossier cold emails per signal+target combo (dedup beyond outreach_log)
ALTER TABLE public.dossier_outreach_log
  ADD COLUMN IF NOT EXISTS draft_id UUID,
  ADD COLUMN IF NOT EXISTS subject TEXT,
  ADD COLUMN IF NOT EXISTS body_preview TEXT;
