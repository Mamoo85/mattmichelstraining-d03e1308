CREATE TABLE IF NOT EXISTS public.owner_magic_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_owner_magic_tokens_email ON public.owner_magic_tokens(email);
CREATE INDEX IF NOT EXISTS idx_owner_magic_tokens_hash ON public.owner_magic_tokens(token_hash);
ALTER TABLE public.owner_magic_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_owner_magic_tokens" ON public.owner_magic_tokens
  FOR ALL TO service_role USING (true) WITH CHECK (true);