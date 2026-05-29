
CREATE POLICY "Users can delete own lift videos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'lift_videos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete own assessments"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'assessments' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete own form checks"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'form_checks' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete own form check videos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'form-check-videos' AND (storage.foldername(name))[1] = auth.uid()::text);
