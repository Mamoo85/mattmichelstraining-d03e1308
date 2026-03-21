
-- Admin Media Files table
CREATE TABLE public.admin_media_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL DEFAULT 'image',
  file_size BIGINT DEFAULT 0,
  tags TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  uploaded_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_media_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage media files"
  ON public.admin_media_files FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- AI Media Jobs table
CREATE TABLE public.ai_media_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_file_ids UUID[] NOT NULL DEFAULT '{}',
  prompt TEXT NOT NULL,
  parameters JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending',
  result_path TEXT,
  result_url TEXT,
  error_message TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

ALTER TABLE public.ai_media_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage ai media jobs"
  ON public.ai_media_jobs FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('admin_media', 'admin_media', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('ai_generated_media', 'ai_generated_media', true);

-- Storage RLS for admin_media
CREATE POLICY "Admins can upload to admin_media"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'admin_media' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update admin_media"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'admin_media' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete from admin_media"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'admin_media' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone can read admin_media"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'admin_media');

-- Storage RLS for ai_generated_media
CREATE POLICY "Admins can upload to ai_generated_media"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'ai_generated_media' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update ai_generated_media"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'ai_generated_media' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete from ai_generated_media"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'ai_generated_media' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone can read ai_generated_media"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'ai_generated_media');
