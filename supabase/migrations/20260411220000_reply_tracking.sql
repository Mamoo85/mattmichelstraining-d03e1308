-- Bounty 4: Tom's Inbox — reply tracking + Ghost Delay drafts

-- Add reply tracking to prospect_email_log
ALTER TABLE prospect_email_log ADD COLUMN IF NOT EXISTS reply_received_at timestamptz;
ALTER TABLE prospect_email_log ADD COLUMN IF NOT EXISTS reply_body text;
ALTER TABLE prospect_email_log ADD COLUMN IF NOT EXISTS reply_category text;

-- Ghost Delay: objection replies staged here, auto-sent after 10 min unless Matt cancels
CREATE TABLE IF NOT EXISTS email_reply_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_email text NOT NULL,
  draft_body text NOT NULL,
  draft_subject text NOT NULL,
  category text NOT NULL,
  send_after timestamptz NOT NULL DEFAULT now() + interval '10 minutes',
  cancelled boolean NOT NULL DEFAULT false,
  sent boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE email_reply_drafts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON email_reply_drafts FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX idx_email_reply_drafts_pending ON email_reply_drafts(send_after)
  WHERE cancelled = false AND sent = false;

-- 1-minute cron: release pending replies whose delay has elapsed
SELECT cron.schedule(
  'release-pending-replies',
  '* * * * *',
  $$
    SELECT net.http_post(
      url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1) || '/functions/v1/release-pending-replies',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1)
      ),
      body := '{}'::jsonb
    );
  $$
);
