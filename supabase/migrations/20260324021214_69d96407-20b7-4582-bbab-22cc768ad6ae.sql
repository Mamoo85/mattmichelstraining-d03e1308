
-- 1. Create client_intake_assessments table (new name to avoid conflict with existing client_assessments)
CREATE TABLE public.intake_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  age integer,
  height text,
  weight text,
  daily_activity text,
  injury_history text NOT NULL,
  equipment_access text,
  goals text,
  posture_photos text[] DEFAULT '{}',
  squat_video text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Enable RLS
ALTER TABLE public.intake_assessments ENABLE ROW LEVEL SECURITY;

-- 3. RLS policies
CREATE POLICY "Users can insert own assessment"
  ON public.intake_assessments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own assessment"
  ON public.intake_assessments FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update assessments"
  ON public.intake_assessments FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 4. Updated_at trigger
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.intake_assessments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Status validation trigger
CREATE OR REPLACE FUNCTION public.validate_intake_assessment_status()
  RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status NOT IN ('pending', 'in_review', 'completed') THEN
    RAISE EXCEPTION 'Invalid intake assessment status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_intake_status
  BEFORE INSERT OR UPDATE ON public.intake_assessments
  FOR EACH ROW EXECUTE FUNCTION public.validate_intake_assessment_status();

-- 6. Create assessments storage bucket (private)
INSERT INTO storage.buckets (id, name, public) VALUES ('assessments', 'assessments', false);

-- 7. Storage RLS: authenticated users upload to their own folder
CREATE POLICY "Users upload own assessment files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'assessments' AND (storage.foldername(name))[1] = auth.uid()::text);

-- 8. Storage RLS: users can read own files, admins read all
CREATE POLICY "Users read own assessment files"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'assessments' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(), 'admin')));
