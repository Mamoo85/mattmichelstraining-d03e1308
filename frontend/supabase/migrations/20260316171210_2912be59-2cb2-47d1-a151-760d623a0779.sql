
-- Coach notes table: admin leaves notes on specific progress log entries
CREATE TABLE public.coach_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  progress_log_id UUID NOT NULL REFERENCES public.progress_logs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  coach_id UUID NOT NULL,
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_coach_notes_progress_log ON public.coach_notes(progress_log_id);
CREATE INDEX idx_coach_notes_user ON public.coach_notes(user_id);

-- RLS
ALTER TABLE public.coach_notes ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "Admins can insert coach notes"
  ON public.coach_notes FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update coach notes"
  ON public.coach_notes FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete coach notes"
  ON public.coach_notes FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can view all coach notes"
  ON public.coach_notes FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Users can view notes on their own logs
CREATE POLICY "Users can view their own coach notes"
  ON public.coach_notes FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
