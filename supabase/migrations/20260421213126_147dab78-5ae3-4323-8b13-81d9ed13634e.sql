ALTER TABLE public.prospect_nudges
  ADD COLUMN IF NOT EXISTS nudge_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS nudge_count int NOT NULL DEFAULT 0;