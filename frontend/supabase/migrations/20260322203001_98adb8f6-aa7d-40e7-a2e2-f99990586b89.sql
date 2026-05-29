
-- Create pr_submissions table for "Prove It" PR zone
CREATE TABLE public.pr_submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exercise_name TEXT NOT NULL,
  weight NUMERIC NOT NULL,
  reps INTEGER NOT NULL DEFAULT 1,
  rep_max INTEGER NOT NULL DEFAULT 3,
  video_path TEXT NOT NULL,
  media_consent BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'pending',
  admin_notes TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID
);

-- Enable RLS
ALTER TABLE public.pr_submissions ENABLE ROW LEVEL SECURITY;

-- Users can insert their own submissions
CREATE POLICY "Users can insert own pr_submissions"
  ON public.pr_submissions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can read their own submissions
CREATE POLICY "Users can read own pr_submissions"
  ON public.pr_submissions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- Admins can update any submission (approve/reject)
CREATE POLICY "Admins can update pr_submissions"
  ON public.pr_submissions FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Validation trigger for status values
CREATE OR REPLACE FUNCTION public.validate_pr_submission_status()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status NOT IN ('pending', 'approved', 'rejected', 'archived') THEN
    RAISE EXCEPTION 'Invalid pr_submission status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_pr_status
  BEFORE INSERT OR UPDATE ON public.pr_submissions
  FOR EACH ROW EXECUTE FUNCTION public.validate_pr_submission_status();
