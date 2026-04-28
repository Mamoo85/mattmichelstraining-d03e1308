-- 1. PROVIDER HEALTH
CREATE OR REPLACE VIEW public.outreach_provider_health_24h
WITH (security_invoker = true) AS
SELECT
  provider,
  count(*)                                                                AS calls_24h,
  count(*) FILTER (WHERE success)                                         AS hits_24h,
  count(*) FILTER (WHERE NOT success)                                     AS errors_24h,
  round(100.0 * count(*) FILTER (WHERE success) / NULLIF(count(*),0), 1)  AS success_rate_pct,
  round(percentile_cont(0.5)  WITHIN GROUP (ORDER BY latency_ms))         AS p50_ms,
  round(percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms))         AS p95_ms,
  max(latency_ms)                                                         AS max_ms
FROM public.ai_call_log
WHERE created_at > now() - interval '24 hours'
GROUP BY provider
ORDER BY calls_24h DESC;

REVOKE ALL ON public.outreach_provider_health_24h FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.outreach_provider_health_24h TO authenticated;

CREATE OR REPLACE VIEW public.outreach_provider_errors_24h
WITH (security_invoker = true) AS
SELECT
  provider,
  COALESCE(NULLIF(left(error_message, 80), ''), 'unknown') AS error_snippet,
  count(*) AS occurrences,
  max(created_at) AS last_seen
FROM public.ai_call_log
WHERE created_at > now() - interval '24 hours'
  AND NOT success
GROUP BY provider, error_snippet
ORDER BY occurrences DESC
LIMIT 50;

REVOKE ALL ON public.outreach_provider_errors_24h FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.outreach_provider_errors_24h TO authenticated;

-- 2. BACKLOG & FRESHNESS
CREATE OR REPLACE VIEW public.outreach_backlog_health
WITH (security_invoker = true) AS
SELECT
  (SELECT count(*) FROM public.outreach_send_queue
     WHERE status = 'queued' AND scheduled_for < now() - interval '1 hour')        AS send_queue_overdue_1h,
  (SELECT count(*) FROM public.outreach_send_queue
     WHERE status = 'queued' AND scheduled_for < now() - interval '24 hours')      AS send_queue_overdue_24h,
  (SELECT count(*) FROM public.outreach_send_queue
     WHERE status = 'claimed' AND claimed_at < now() - interval '15 minutes')      AS send_queue_stuck_claimed,
  (SELECT count(*) FROM public.outreach_send_queue
     WHERE status = 'dead')                                                        AS send_queue_dead_total,
  (SELECT count(*) FROM public.contractor_outreach_prospects
     WHERE source = 'google_maps_statewide' AND email IS NULL)                     AS statewide_unenriched_total,
  (SELECT count(*) FROM public.contractor_outreach_prospects
     WHERE source = 'google_maps_statewide' AND email IS NULL
       AND created_at < now() - interval '48 hours')                               AS statewide_unenriched_48h,
  (SELECT count(*) FROM public.outreach_replies
     WHERE NOT handled
       AND sentiment IN ('positive','negative')
       AND created_at < now() - interval '6 hours')                                AS unhandled_replies_6h,
  (SELECT count(*) FROM public.contractor_outreach_audit_log
     WHERE event = 'bounce' AND created_at > now() - interval '24 hours')          AS bounces_24h;

REVOKE ALL ON public.outreach_backlog_health FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.outreach_backlog_health TO authenticated;

-- 3. PER-TERRITORY FUNNEL + DEAD-ZONE
CREATE OR REPLACE VIEW public.outreach_territory_funnel_30d
WITH (security_invoker = true) AS
WITH prospect_buckets AS (
  SELECT id, trade, city
  FROM public.contractor_outreach_prospects
  WHERE created_at > now() - interval '30 days'
),
event_counts AS (
  SELECT
    pb.trade,
    pb.city,
    count(DISTINCT pb.id)                                                                          AS prospects,
    count(DISTINCT a.prospect_id) FILTER (WHERE a.event = 'sent')                                  AS sent,
    count(*) FILTER (WHERE a.event = 'opened')                                                     AS opened,
    count(*) FILTER (WHERE a.event = 'clicked')                                                    AS clicked,
    count(*) FILTER (WHERE a.event = 'replied')                                                    AS replied,
    count(*) FILTER (WHERE a.event = 'bounce')                                                     AS bounced,
    max(a.created_at) FILTER (WHERE a.event = 'sent')                                              AS last_sent_at,
    max(a.created_at) FILTER (WHERE a.event = 'replied')                                           AS last_replied_at
  FROM prospect_buckets pb
  LEFT JOIN public.contractor_outreach_audit_log a
    ON a.prospect_id = pb.id
   AND a.created_at > now() - interval '30 days'
  GROUP BY pb.trade, pb.city
)
SELECT
  trade,
  COALESCE(city, '(unknown)')                                                  AS city,
  prospects,
  sent,
  opened,
  clicked,
  replied,
  bounced,
  round(100.0 * sent     / NULLIF(prospects, 0), 1)                            AS send_rate_pct,
  round(100.0 * replied  / NULLIF(sent, 0), 1)                                 AS reply_rate_pct,
  round(100.0 * bounced  / NULLIF(sent, 0), 1)                                 AS bounce_rate_pct,
  last_sent_at,
  last_replied_at,
  (sent = 0 AND prospects > 5)                                                 AS flag_no_sends,
  (sent >= 25 AND replied = 0)                                                 AS flag_no_replies,
  (sent >= 10 AND bounced::numeric / NULLIF(sent,0) > 0.20)                    AS flag_high_bounce
FROM event_counts
ORDER BY prospects DESC;

REVOKE ALL ON public.outreach_territory_funnel_30d FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.outreach_territory_funnel_30d TO authenticated;

-- 4. COST & QUOTA TRACKER
CREATE TABLE IF NOT EXISTS public.provider_cost_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  unit text NOT NULL,
  units numeric NOT NULL DEFAULT 0,
  cost_usd numeric(10,4),
  caller text,
  meta jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_provider_cost_provider_created
  ON public.provider_cost_ledger (provider, created_at DESC);

ALTER TABLE public.provider_cost_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_pcl" ON public.provider_cost_ledger;
CREATE POLICY "service_role_all_pcl" ON public.provider_cost_ledger
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "admin_read_pcl" ON public.provider_cost_ledger;
CREATE POLICY "admin_read_pcl" ON public.provider_cost_ledger
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE VIEW public.provider_cost_daily_14d
WITH (security_invoker = true) AS
SELECT
  date_trunc('day', created_at)::date AS day,
  provider,
  unit,
  sum(units)                            AS units_total,
  round(sum(cost_usd)::numeric, 2)      AS cost_usd_total,
  count(*)                              AS event_count
FROM public.provider_cost_ledger
WHERE created_at > now() - interval '14 days'
GROUP BY 1, 2, 3
ORDER BY 1 DESC, 2;

REVOKE ALL ON public.provider_cost_daily_14d FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.provider_cost_daily_14d TO authenticated;

CREATE OR REPLACE FUNCTION public.log_provider_cost(
  _provider text,
  _unit text,
  _units numeric,
  _cost_usd numeric DEFAULT NULL,
  _caller text DEFAULT NULL,
  _meta jsonb DEFAULT '{}'::jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.provider_cost_ledger (provider, unit, units, cost_usd, caller, meta)
  VALUES (_provider, _unit, _units, _cost_usd, _caller, COALESCE(_meta, '{}'::jsonb));
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_provider_cost(text, text, numeric, numeric, text, jsonb) TO service_role;