CREATE TABLE public.schema_validation_failures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  component text NOT NULL,
  table_name text NOT NULL,
  select_fields text,
  reason text NOT NULL,
  missing text[] DEFAULT '{}'::text[],
  forbidden text[] DEFAULT '{}'::text[],
  raw_error text,
  user_agent text,
  route text,
  detected_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_schema_validation_failures_detected_at
  ON public.schema_validation_failures (detected_at DESC);

CREATE INDEX idx_schema_validation_failures_component
  ON public.schema_validation_failures (component, detected_at DESC);

ALTER TABLE public.schema_validation_failures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can log schema validation failures"
  ON public.schema_validation_failures
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can view schema validation failures"
  ON public.schema_validation_failures
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role full access to schema validation failures"
  ON public.schema_validation_failures
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);