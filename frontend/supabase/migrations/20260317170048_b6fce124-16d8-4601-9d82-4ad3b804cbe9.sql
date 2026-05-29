
-- Community workouts table for the Mattletes workout bank
CREATE TABLE public.community_workouts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  creator_name TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  exercises JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_public BOOLEAN NOT NULL DEFAULT true,
  likes_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.community_workouts ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can view public workouts
CREATE POLICY "Anyone can view public community workouts"
  ON public.community_workouts FOR SELECT
  TO authenticated
  USING (is_public = true);

-- Users can view their own workouts (even private)
CREATE POLICY "Users can view own community workouts"
  ON public.community_workouts FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can create their own workouts
CREATE POLICY "Users can create community workouts"
  ON public.community_workouts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own workouts
CREATE POLICY "Users can update own community workouts"
  ON public.community_workouts FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can delete their own workouts
CREATE POLICY "Users can delete own community workouts"
  ON public.community_workouts FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Admins can manage all
CREATE POLICY "Admins can manage all community workouts"
  ON public.community_workouts FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
CREATE TRIGGER update_community_workouts_updated_at
  BEFORE UPDATE ON public.community_workouts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
