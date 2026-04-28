-- Hourly send metrics (last 7 days), per channel
CREATE OR REPLACE VIEW public.outreach_send_metrics_hourly
WITH (security_invoker = true) AS
SELECT
  date_trunc('hour', sent_at) AS hour,
  channel,
  count(*) FILTER (WHERE status = 'sent') AS sent_count,
  count(*) FILTER (WHERE status IN ('failed','dead')) AS failed_count,
  avg(attempts)::numeric(10,2) AS avg_attempts
FROM public.outreach_send_queue
WHERE sent_at > now() - interval '7 days'
GROUP BY 1, 2
ORDER BY 1 DESC;

-- Waterfall stage hit rates (from contractor_outreach_prospects.enrichment_trace jsonb)
CREATE OR REPLACE VIEW public.outreach_waterfall_stage_stats
WITH (security_invoker = true) AS
WITH unnested AS (
  SELECT
    p.id,
    (trace->>'stage') AS stage,
    (trace->>'status') AS status,
    NULLIF(trace->>'confidence','')::numeric AS confidence,
    p.created_at
  FROM public.contractor_outreach_prospects p,
       LATERAL jsonb_array_elements(COALESCE(p.enrichment_trace, '[]'::jsonb)) AS trace
  WHERE p.created_at > now() - interval '30 days'
)
SELECT
  stage,
  count(*) AS attempts,
  count(*) FILTER (WHERE status = 'success') AS hits,
  count(*) FILTER (WHERE status IN ('miss','no_match','error')) AS misses,
  round(avg(confidence) FILTER (WHERE status = 'success'), 1) AS avg_confidence,
  round(100.0 * count(*) FILTER (WHERE status = 'success') / NULLIF(count(*),0), 1) AS hit_rate_pct
FROM unnested
WHERE stage IS NOT NULL
GROUP BY stage
ORDER BY attempts DESC;

-- Funnel summary (last 30 days)
CREATE OR REPLACE VIEW public.outreach_funnel_summary
WITH (security_invoker = true) AS
SELECT
  (SELECT count(*) FROM public.contractor_outreach_prospects WHERE created_at > now() - interval '30 days') AS prospects_30d,
  (SELECT count(DISTINCT prospect_id) FROM public.contractor_outreach_audit_log WHERE event = 'sent' AND created_at > now() - interval '30 days') AS sent_30d,
  (SELECT count(*) FROM public.contractor_outreach_audit_log WHERE event = 'opened' AND created_at > now() - interval '30 days') AS opened_30d,
  (SELECT count(*) FROM public.contractor_outreach_audit_log WHERE event = 'clicked' AND created_at > now() - interval '30 days') AS clicked_30d,
  (SELECT count(*) FROM public.contractor_outreach_audit_log WHERE event = 'replied' AND created_at > now() - interval '30 days') AS replied_30d,
  (SELECT count(*) FROM public.contractor_outreach_audit_log WHERE event = 'bounce' AND created_at > now() - interval '30 days') AS bounced_30d,
  (SELECT count(*) FROM public.contractor_outreach_audit_log WHERE event = 'unsubscribed' AND created_at > now() - interval '30 days') AS unsubscribed_30d,
  (SELECT count(*) FROM public.contractor_outreach_audit_log WHERE event IN ('quiet_hours_blocked','daily_cap_blocked','suppressed') AND created_at > now() - interval '30 days') AS blocked_30d;

-- Lock down: only admins can read
REVOKE ALL ON public.outreach_send_metrics_hourly FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.outreach_waterfall_stage_stats FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.outreach_funnel_summary FROM PUBLIC, anon, authenticated;

-- Grant via security invoker means underlying RLS applies; but views need explicit grants.
-- We grant to authenticated; RLS on base tables already restricts to admins via has_role().
GRANT SELECT ON public.outreach_send_metrics_hourly TO authenticated;
GRANT SELECT ON public.outreach_waterfall_stage_stats TO authenticated;
GRANT SELECT ON public.outreach_funnel_summary TO authenticated;