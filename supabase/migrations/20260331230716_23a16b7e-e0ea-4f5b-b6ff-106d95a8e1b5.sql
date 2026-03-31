ALTER TABLE public.outreach_leads
  ADD COLUMN IF NOT EXISTS ai_drafted_subject TEXT,
  ADD COLUMN IF NOT EXISTS ai_drafted_pitch TEXT,
  ADD COLUMN IF NOT EXISTS ai_drafted_at TIMESTAMPTZ;