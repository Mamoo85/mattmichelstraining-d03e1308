
-- Create storage bucket for exercise demo videos
INSERT INTO storage.buckets (id, name, public)
VALUES ('exercise_videos', 'exercise_videos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow admins to upload/update/delete exercise videos
CREATE POLICY "Admins can upload exercise videos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'exercise_videos'
  AND public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Admins can update exercise videos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'exercise_videos'
  AND public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Admins can delete exercise videos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'exercise_videos'
  AND public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Anyone can view exercise videos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'exercise_videos');
