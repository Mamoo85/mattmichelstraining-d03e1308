
-- Wave 6: latency prune + walker target CRUD RPCs

-- Nightly prune: keep 30 days of latency samples
CREATE OR REPLACE FUNCTION public.prune_enrichment_provider_latency()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  removed integer;
BEGIN
  DELETE FROM public.enrichment_provider_latency
  WHERE sampled_at < (now() - interval '30 days');
  GET DIAGNOSTICS removed = ROW_COUNT;
  RETURN removed;
END;
$$;

REVOKE ALL ON FUNCTION public.prune_enrichment_provider_latency() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prune_enrichment_provider_latency() TO service_role;

-- Walker target upsert (admin-only)
CREATE OR REPLACE FUNCTION public.upsert_walker_target(
  _trade text,
  _city text,
  _enabled boolean DEFAULT true,
  _priority smallint DEFAULT 5,
  _max_per_run integer DEFAULT 50,
  _daily_cost_cap_usd numeric DEFAULT 10,
  _notes text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'admin role required';
  END IF;

  INSERT INTO public.enrichment_walker_targets
    (trade, city, enabled, priority, max_per_run, daily_cost_cap_usd, notes)
  VALUES
    (_trade, _city, _enabled, _priority, _max_per_run, _daily_cost_cap_usd, _notes)
  ON CONFLICT (trade, city) DO UPDATE
    SET enabled = EXCLUDED.enabled,
        priority = EXCLUDED.priority,
        max_per_run = EXCLUDED.max_per_run,
        daily_cost_cap_usd = EXCLUDED.daily_cost_cap_usd,
        notes = COALESCE(EXCLUDED.notes, public.enrichment_walker_targets.notes);
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_walker_target(text, text, boolean, smallint, integer, numeric, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.upsert_walker_target(text, text, boolean, smallint, integer, numeric, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.delete_walker_target(_trade text, _city text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'admin role required';
  END IF;
  DELETE FROM public.enrichment_walker_targets WHERE trade = _trade AND city = _city;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_walker_target(text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.delete_walker_target(text, text) TO authenticated;

-- Reset alert cooldown so a stuck alert can re-page (admin-only)
CREATE OR REPLACE FUNCTION public.reset_alert_cooldown(_kind text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'admin role required';
  END IF;
  DELETE FROM public.outreach_alert_cooldowns WHERE kind = _kind;
END;
$$;

REVOKE ALL ON FUNCTION public.reset_alert_cooldown(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.reset_alert_cooldown(text) TO authenticated;

-- Ensure unique constraint on walker target (idempotent)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname='public' AND indexname='enrichment_walker_targets_trade_city_uq'
  ) THEN
    CREATE UNIQUE INDEX enrichment_walker_targets_trade_city_uq
      ON public.enrichment_walker_targets (trade, city);
  END IF;
END $$;

-- Schedule nightly latency prune (2:30am ET = 06:30 UTC, before vacuum at 9 UTC)
SELECT cron.schedule(
  'enrichment-latency-prune-nightly',
  '30 6 * * *',
  $$ SELECT public.prune_enrichment_provider_latency(); $$
)
WHERE NOT EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'enrichment-latency-prune-nightly'
);
