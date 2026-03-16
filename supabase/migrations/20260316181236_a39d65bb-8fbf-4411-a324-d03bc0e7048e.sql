
-- Challenge participants table
CREATE TABLE public.challenge_participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  challenge_id TEXT NOT NULL,
  is_public BOOLEAN NOT NULL DEFAULT false,
  current_value INTEGER NOT NULL DEFAULT 0,
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, challenge_id)
);

ALTER TABLE public.challenge_participants ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can see public participants (for leaderboard)
CREATE POLICY "Anyone can view public participants"
ON public.challenge_participants
FOR SELECT
TO authenticated
USING (is_public = true);

-- Users can view their own participation regardless of visibility
CREATE POLICY "Users can view own participation"
ON public.challenge_participants
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Admins can view all
CREATE POLICY "Admins can view all participants"
ON public.challenge_participants
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Users can insert their own
CREATE POLICY "Users can join challenges"
ON public.challenge_participants
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can update their own
CREATE POLICY "Users can update own participation"
ON public.challenge_participants
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- Users can delete (opt out)
CREATE POLICY "Users can opt out"
ON public.challenge_participants
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Admins can update all
CREATE POLICY "Admins can update all participants"
ON public.challenge_participants
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
