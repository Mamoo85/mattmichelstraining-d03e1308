
DROP POLICY "Authenticated can insert competitor_watch_clients" ON public.competitor_watch_clients;
DROP POLICY "Authenticated can insert linkedin_ghostwriting_clients" ON public.linkedin_ghostwriting_clients;
DROP POLICY "Authenticated can insert market_intel_clients" ON public.market_intel_clients;
DROP POLICY "Authenticated can insert newsletter_service_clients" ON public.newsletter_service_clients;
DROP POLICY "Authenticated can insert social_captions_clients" ON public.social_captions_clients;

CREATE POLICY "Admins can insert competitor_watch_clients"
  ON public.competitor_watch_clients FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = (select auth.uid()) AND role = 'admin'));

CREATE POLICY "Admins can insert linkedin_ghostwriting_clients"
  ON public.linkedin_ghostwriting_clients FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = (select auth.uid()) AND role = 'admin'));

CREATE POLICY "Admins can insert market_intel_clients"
  ON public.market_intel_clients FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = (select auth.uid()) AND role = 'admin'));

CREATE POLICY "Admins can insert newsletter_service_clients"
  ON public.newsletter_service_clients FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = (select auth.uid()) AND role = 'admin'));

CREATE POLICY "Admins can insert social_captions_clients"
  ON public.social_captions_clients FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = (select auth.uid()) AND role = 'admin'));
