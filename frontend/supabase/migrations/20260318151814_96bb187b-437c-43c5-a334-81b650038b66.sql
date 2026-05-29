CREATE TABLE public.parent_inbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_email TEXT NOT NULL,
  parent_name TEXT,
  child_user_id UUID,
  subject TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL,
  sentiment TEXT NOT NULL DEFAULT 'neutral',
  is_urgent BOOLEAN NOT NULL DEFAULT false,
  urgent_reason TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  admin_reply TEXT,
  replied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.parent_inbox ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage parent inbox"
  ON public.parent_inbox FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role can insert parent inbox"
  ON public.parent_inbox FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can read parent inbox"
  ON public.parent_inbox FOR SELECT
  TO service_role
  USING (true);