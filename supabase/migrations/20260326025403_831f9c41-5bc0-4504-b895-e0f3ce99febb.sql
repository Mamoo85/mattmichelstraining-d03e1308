
CREATE TABLE public.user_linked_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(email)
);
ALTER TABLE public.user_linked_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own emails" ON public.user_linked_emails
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins manage all" ON public.user_linked_emails
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
