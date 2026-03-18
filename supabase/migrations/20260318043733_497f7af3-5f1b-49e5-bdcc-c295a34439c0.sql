
-- Table to store parent invite tokens
CREATE TABLE public.parent_invite_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_user_id UUID NOT NULL,
  token TEXT NOT NULL UNIQUE,
  child_name TEXT,
  is_used BOOLEAN NOT NULL DEFAULT false,
  used_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  used_at TIMESTAMPTZ
);

-- RLS
ALTER TABLE public.parent_invite_tokens ENABLE ROW LEVEL SECURITY;

-- Parents can see their own invite tokens
CREATE POLICY "Parents can view own invites"
  ON public.parent_invite_tokens
  FOR SELECT
  TO authenticated
  USING (parent_user_id = auth.uid());

-- Parents can create invite tokens
CREATE POLICY "Parents can create invites"
  ON public.parent_invite_tokens
  FOR INSERT
  TO authenticated
  WITH CHECK (parent_user_id = auth.uid());

-- Anyone authenticated can read an invite by token (for redemption)
CREATE POLICY "Anyone can read invite by token"
  ON public.parent_invite_tokens
  FOR SELECT
  TO authenticated
  USING (true);

-- System updates on redemption (via service role in edge function)
CREATE POLICY "Users can update invites they redeem"
  ON public.parent_invite_tokens
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
