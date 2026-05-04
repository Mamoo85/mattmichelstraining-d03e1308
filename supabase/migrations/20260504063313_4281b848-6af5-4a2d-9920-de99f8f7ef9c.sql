
CREATE TABLE IF NOT EXISTS public.account_team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_owner_id UUID NOT NULL,
  member_email TEXT NOT NULL,
  member_user_id UUID,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member','viewer','admin')),
  status TEXT NOT NULL DEFAULT 'invited' CHECK (status IN ('invited','active','revoked')),
  invite_token TEXT UNIQUE,
  invited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (account_owner_id, member_email)
);

CREATE INDEX IF NOT EXISTS idx_atm_owner ON public.account_team_members(account_owner_id);
CREATE INDEX IF NOT EXISTS idx_atm_member_user ON public.account_team_members(member_user_id) WHERE member_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_atm_email ON public.account_team_members(lower(member_email));

ALTER TABLE public.account_team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_atm" ON public.account_team_members
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "owners_view_their_team" ON public.account_team_members
  FOR SELECT TO authenticated
  USING (account_owner_id = auth.uid() OR member_user_id = auth.uid());

CREATE POLICY "owners_invite_team" ON public.account_team_members
  FOR INSERT TO authenticated
  WITH CHECK (account_owner_id = auth.uid());

CREATE POLICY "owners_update_team" ON public.account_team_members
  FOR UPDATE TO authenticated
  USING (account_owner_id = auth.uid())
  WITH CHECK (account_owner_id = auth.uid());

CREATE POLICY "owners_delete_team" ON public.account_team_members
  FOR DELETE TO authenticated
  USING (account_owner_id = auth.uid());

-- Helper function: returns the account owner ID for a given user (themselves if owner, or their owner if a team member)
CREATE OR REPLACE FUNCTION public.get_account_owner(_user_id UUID)
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT account_owner_id FROM public.account_team_members
       WHERE member_user_id = _user_id AND status = 'active' LIMIT 1),
    _user_id
  );
$$;

CREATE TRIGGER trg_atm_updated_at
  BEFORE UPDATE ON public.account_team_members
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
