
INSERT INTO storage.buckets (id, name, public) VALUES ('exercise_reference_images', 'exercise_reference_images', true) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Admins can upload reference images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'exercise_reference_images' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete reference images" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'exercise_reference_images' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Anyone can view reference images" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'exercise_reference_images');
