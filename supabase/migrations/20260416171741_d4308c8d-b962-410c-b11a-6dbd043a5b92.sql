-- Allow admins to read all postcard data
CREATE POLICY "Admins can read postcard_prospects"
  ON public.postcard_prospects FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can read postcard_campaigns"
  ON public.postcard_campaigns FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can read postcard_conversions"
  ON public.postcard_conversions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Also allow admins to insert/update/delete for full management
CREATE POLICY "Admins can manage postcard_prospects"
  ON public.postcard_prospects FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage postcard_campaigns"
  ON public.postcard_campaigns FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage postcard_conversions"
  ON public.postcard_conversions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Add audience_type column
ALTER TABLE public.postcard_campaigns ADD COLUMN IF NOT EXISTS audience_type TEXT;