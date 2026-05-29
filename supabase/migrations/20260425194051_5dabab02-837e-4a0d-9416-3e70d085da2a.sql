ALTER TABLE public.enrichment_provider_health
  ADD COLUMN IF NOT EXISTS disabled_until timestamptz,
  ADD COLUMN IF NOT EXISTS disabled_reason text;

-- Helper: mark a provider disabled for N days
CREATE OR REPLACE FUNCTION public.disable_enrichment_provider(
  p_provider text,
  p_reason text,
  p_days int DEFAULT 7
) RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.enrichment_provider_health (provider, disabled_until, disabled_reason, updated_at)
  VALUES (p_provider, now() + (p_days || ' days')::interval, p_reason, now())
  ON CONFLICT (provider) DO UPDATE
    SET disabled_until = EXCLUDED.disabled_until,
        disabled_reason = EXCLUDED.disabled_reason,
        updated_at = now();
$$;

-- Helper: check if a provider is currently disabled
CREATE OR REPLACE FUNCTION public.is_enrichment_provider_disabled(p_provider text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT disabled_until > now()
     FROM public.enrichment_provider_health
     WHERE provider = p_provider),
    false
  );
$$;