-- DWA Level 5 Autonomy Agents: tables + columns + crons
-- dwa-operator (self-healing campaign manager) + dwa-closer (bundle pitch agent)

-- ── outreach_cooldowns ──────────────────────────────────────────────────────
-- Tracks which agent last contacted a prospect and when.
-- Prevents Tom, prospector, and closer from double-sending within 7 days.
CREATE TABLE IF NOT EXISTS outreach_cooldowns (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_email     text,
  prospect_phone     text,
  last_agent         text        NOT NULL,
  last_contacted_at  timestamptz NOT NULL DEFAULT now(),
  last_channel       text        NOT NULL CHECK (last_channel IN ('sms', 'email'))
);

-- Unique index per contact point so upserts work cleanly
CREATE UNIQUE INDEX IF NOT EXISTS idx_cooldowns_email
  ON outreach_cooldowns(prospect_email) WHERE prospect_email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_cooldowns_phone
  ON outreach_cooldowns(prospect_phone) WHERE prospect_phone IS NOT NULL;

ALTER TABLE outreach_cooldowns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON outreach_cooldowns
  FOR ALL USING (true) WITH CHECK (true);

-- ── campaign_copy_variants ──────────────────────────────────────────────────
-- Stores AI-generated A/B SMS copy alternatives for paused campaigns.
-- Matt replies "A" or "B" via SMS to select and resume.
CREATE TABLE IF NOT EXISTS campaign_copy_variants (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id   uuid        NOT NULL REFERENCES dead_lead_campaigns(id) ON DELETE CASCADE,
  variant_label text        NOT NULL CHECK (variant_label IN ('A', 'B')),
  drip1_copy    text        NOT NULL,
  drip2_copy    text        NOT NULL,
  drip3_copy    text        NOT NULL,
  generated_at  timestamptz NOT NULL DEFAULT now(),
  selected      boolean     NOT NULL DEFAULT false,
  selected_at   timestamptz,
  UNIQUE(campaign_id, variant_label)
);

ALTER TABLE campaign_copy_variants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON campaign_copy_variants
  FOR ALL USING (true) WITH CHECK (true);

-- ── dead_lead_campaigns extra columns ──────────────────────────────────────
ALTER TABLE dead_lead_campaigns
  ADD COLUMN IF NOT EXISTS pause_reason  text,
  ADD COLUMN IF NOT EXISTS paused_at     timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at  timestamptz;

-- ── agent heartbeats seeds ──────────────────────────────────────────────────
INSERT INTO agent_heartbeats (agent_name, last_run_at, last_status)
VALUES
  ('dwa-operator', now(), 'ok'),
  ('dwa-closer',   now(), 'ok')
ON CONFLICT (agent_name) DO NOTHING;

-- ── cron: dwa-operator every 4 hours ───────────────────────────────────────
SELECT cron.schedule(
  'dwa-operator-4h',
  '0 0,4,8,12,16,20 * * *',
  $$SELECT net.http_post(
      url     := current_setting('app.supabase_url') || '/functions/v1/dwa-operator',
      headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.service_role_key')),
      body    := '{}'::jsonb
    )$$
);

-- ── cron: dwa-closer daily 2pm ET (18:00 UTC) ──────────────────────────────
SELECT cron.schedule(
  'dwa-closer-daily',
  '0 18 * * *',
  $$SELECT net.http_post(
      url     := current_setting('app.supabase_url') || '/functions/v1/dwa-closer',
      headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.service_role_key')),
      body    := '{}'::jsonb
    )$$
);
