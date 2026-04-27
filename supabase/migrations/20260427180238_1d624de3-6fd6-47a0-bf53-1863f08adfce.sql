CREATE POLICY "admins_select_sms_reply_drafts"
  ON public.sms_reply_drafts
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins_insert_sms_reply_drafts"
  ON public.sms_reply_drafts
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins_update_sms_reply_drafts"
  ON public.sms_reply_drafts
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));