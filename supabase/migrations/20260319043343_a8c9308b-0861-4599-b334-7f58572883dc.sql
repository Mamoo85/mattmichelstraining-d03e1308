
-- 1. Create client_assessments table
CREATE TABLE public.client_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_user_id uuid NOT NULL,
  admin_user_id uuid NOT NULL,
  media_url text NOT NULL,
  ai_findings jsonb,
  draft_program jsonb,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Validation trigger for status instead of CHECK constraint
CREATE OR REPLACE FUNCTION public.validate_assessment_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status NOT IN ('draft', 'approved', 'rejected') THEN
    RAISE EXCEPTION 'Invalid status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_assessment_status
  BEFORE INSERT OR UPDATE ON public.client_assessments
  FOR EACH ROW EXECUTE FUNCTION public.validate_assessment_status();

-- Auto-update updated_at
CREATE TRIGGER trg_client_assessments_updated_at
  BEFORE UPDATE ON public.client_assessments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.client_assessments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can select assessments"
  ON public.client_assessments FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert assessments"
  ON public.client_assessments FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update assessments"
  ON public.client_assessments FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 2. Create biomechanics_media storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('biomechanics_media', 'biomechanics_media', false);

-- Storage RLS: admin-only upload
CREATE POLICY "Admins can upload biomechanics media"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'biomechanics_media'
    AND public.has_role(auth.uid(), 'admin')
  );

-- Storage RLS: admin-only view
CREATE POLICY "Admins can view biomechanics media"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'biomechanics_media'
    AND public.has_role(auth.uid(), 'admin')
  );
