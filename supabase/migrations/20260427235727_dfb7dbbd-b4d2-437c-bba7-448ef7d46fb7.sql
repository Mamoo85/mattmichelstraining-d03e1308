-- Per-industry counts view for the Growth Signals dashboard
-- Security invoker: respects RLS on the underlying table
CREATE OR REPLACE VIEW public.industry_pulse_signals_counts
WITH (security_invoker = true) AS
SELECT
  COALESCE(industry, 'Uncategorized') AS industry,
  COUNT(*)::int                                                        AS total,
  COUNT(*) FILTER (WHERE confidence >= 7)::int                         AS high,
  COUNT(*) FILTER (WHERE confidence BETWEEN 4 AND 6)::int              AS medium,
  COUNT(*) FILTER (WHERE confidence < 4)::int                          AS low,
  COUNT(*) FILTER (WHERE cross_referenced)::int                        AS cross_ref,
  MAX(detected_at)                                                     AS latest_detected_at
FROM public.industry_pulse_signals
GROUP BY COALESCE(industry, 'Uncategorized');

GRANT SELECT ON public.industry_pulse_signals_counts TO authenticated, service_role;

-- Supporting index for the new server-side filtered queries
-- (industry, confidence DESC) covers the common "filter by industry, sort by confidence" pattern
CREATE INDEX IF NOT EXISTS idx_industry_pulse_signals_industry_confidence
  ON public.industry_pulse_signals (industry, confidence DESC, detected_at DESC, id);

-- Index for the deterministic global tie-break (used when industry = All)
CREATE INDEX IF NOT EXISTS idx_industry_pulse_signals_confidence_detected_id
  ON public.industry_pulse_signals (confidence DESC, detected_at DESC, id);