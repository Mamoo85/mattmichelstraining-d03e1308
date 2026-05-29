-- AutoPOD waitlist table for SaaS lead capture
CREATE TABLE IF NOT EXISTS autopod_waitlist (
  id          bigserial PRIMARY KEY,
  email       text        NOT NULL,
  source      text        DEFAULT 'landing',
  notes       text,
  contacted   boolean     DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS autopod_waitlist_email_idx
  ON autopod_waitlist(email);

-- Enable RLS
ALTER TABLE autopod_waitlist ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert (public waitlist signup)
CREATE POLICY "Public can join waitlist"
  ON autopod_waitlist FOR INSERT
  WITH CHECK (true);

-- Only service role can read (admin only)
CREATE POLICY "Service role reads waitlist"
  ON autopod_waitlist FOR SELECT
  USING (auth.role() = 'service_role');
