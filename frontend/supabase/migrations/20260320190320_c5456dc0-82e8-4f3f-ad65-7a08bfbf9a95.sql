
-- In-person invite tokens: admin generates a token, texts the link, client redeems on signup
CREATE TABLE public.in_person_invite_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_used BOOLEAN NOT NULL DEFAULT false,
  used_at TIMESTAMPTZ,
  used_by UUID,
  label TEXT
);

ALTER TABLE public.in_person_invite_tokens ENABLE ROW LEVEL SECURITY;

-- Only admins can read/write invite tokens
CREATE POLICY "Admins manage in_person_invite_tokens"
  ON public.in_person_invite_tokens
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
