
-- Storage bucket for form check videos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('form-check-videos', 'form-check-videos', true, 104857600, ARRAY['video/mp4', 'video/quicktime', 'video/x-msvideo']);

-- RLS: authenticated users can upload their own videos
CREATE POLICY "Users can upload videos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'form-check-videos' AND (storage.foldername(name))[1] = auth.uid()::text);

-- RLS: anyone can read videos (for coach to view)
CREATE POLICY "Anyone can view form check videos" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'form-check-videos');

-- Coach messages table for program-specific questions
CREATE TABLE public.program_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  program_id UUID NOT NULL REFERENCES public.training_programs(id) ON DELETE CASCADE,
  exercise_name TEXT NOT NULL DEFAULT '',
  week_number INTEGER NOT NULL DEFAULT 1,
  day_number INTEGER NOT NULL DEFAULT 1,
  message TEXT NOT NULL,
  video_url TEXT,
  coach_reply TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.program_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own program messages" ON public.program_messages
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own program messages" ON public.program_messages
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage all program messages" ON public.program_messages
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
