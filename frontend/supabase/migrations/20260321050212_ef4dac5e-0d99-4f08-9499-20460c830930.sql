
-- Create lift_video_status enum
CREATE TYPE public.lift_video_status AS ENUM ('pending_review', 'approved', 'rejected', 'archived');

-- Create lift_videos table
CREATE TABLE public.lift_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  progress_log_id UUID NOT NULL REFERENCES public.progress_logs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  video_path TEXT NOT NULL,
  ai_analysis TEXT,
  status lift_video_status NOT NULL DEFAULT 'pending_review',
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID
);

-- Index for fast lookups
CREATE INDEX idx_lift_videos_status ON public.lift_videos(status);
CREATE INDEX idx_lift_videos_user ON public.lift_videos(user_id);
CREATE INDEX idx_lift_videos_log ON public.lift_videos(progress_log_id);

-- Enable RLS
ALTER TABLE public.lift_videos ENABLE ROW LEVEL SECURITY;

-- Users can insert their own videos
CREATE POLICY "Users can insert own lift videos"
  ON public.lift_videos FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can only see their own APPROVED videos
CREATE POLICY "Users can view own approved lift videos"
  ON public.lift_videos FOR SELECT TO authenticated
  USING (
    (auth.uid() = user_id AND status = 'approved')
    OR public.has_role(auth.uid(), 'admin')
  );

-- Admins can update (approve/reject/archive)
CREATE POLICY "Admins can update lift videos"
  ON public.lift_videos FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Admins can delete
CREATE POLICY "Admins can delete lift videos"
  ON public.lift_videos FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Create private storage bucket for lift videos
INSERT INTO storage.buckets (id, name, public)
VALUES ('lift_videos', 'lift_videos', false);

-- Storage RLS: authenticated users can upload to their own folder
CREATE POLICY "Users can upload lift videos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'lift_videos' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Admins can read all lift videos
CREATE POLICY "Admins can read all lift videos"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'lift_videos' AND public.has_role(auth.uid(), 'admin'));

-- Users can read their own approved lift videos (handled via signed URLs from admin)
CREATE POLICY "Users can read own lift videos"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'lift_videos' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Admins can delete lift videos from storage
CREATE POLICY "Admins can delete lift videos from storage"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'lift_videos' AND public.has_role(auth.uid(), 'admin'));
