CREATE POLICY "Authenticated users can subscribe"
  ON public.newsletter_subscribers FOR INSERT
  TO authenticated
  WITH CHECK (true);