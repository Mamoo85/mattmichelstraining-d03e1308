CREATE OR REPLACE VIEW public.unified_lead_marketplace_view
WITH (security_invoker = true) AS
SELECT m.id::text AS id,
    'mortgage'::text AS product,
    COALESCE(m.signal_type, 'mortgage_radar'::text) AS signal_type,
    COALESCE(m.signal_strength_tier,
        CASE
            WHEN m.score >= 8 THEN 'hot'
            WHEN m.score >= 5 THEN 'warm'
            ELSE 'cool'
        END) AS signal_strength_tier,
    m.score,
    m.score_percentile,
    m.signal_velocity,
    m.zip_heat_index,
    m.days_on_radar,
    m.nearby_signal_count,
    m.equity_range_low_cents,
    m.equity_range_high_cents,
    m.year_built,
    m.last_sale_price_cents,
    m.last_sale_date,
    m.est_loan_low_cents,
    m.est_loan_high_cents,
    m.tcpa_clear,
    m.human_summary,
    m.buyer_type,
        CASE
            WHEN m.suggested_opener IS NULL THEN NULL::jsonb
            WHEN m.suggested_opener ~ '^\s*[\{\[]'::text THEN m.suggested_opener::jsonb
            ELSE jsonb_build_object('text', m.suggested_opener)
        END AS suggested_opener,
    m.provenance_source_urls,
    m.created_at,
    m.city,
    m.state,
    m.zip
   FROM mortgage_radar_leads m
UNION ALL
 SELECT c.id::text AS id,
    'talent'::text AS product,
    COALESCE(c.source, 'talent_radar'::text) AS signal_type,
    COALESCE(c.signal_strength_tier,
        CASE
            WHEN c.score >= 8 THEN 'hot'
            WHEN c.score >= 5 THEN 'warm'
            ELSE 'cool'
        END) AS signal_strength_tier,
    c.score,
    c.score_percentile,
    c.signal_velocity,
    c.zip_heat_index,
    c.days_on_radar,
    c.nearby_signal_count,
    NULL::bigint AS equity_range_low_cents,
    NULL::bigint AS equity_range_high_cents,
    NULL::integer AS year_built,
    NULL::bigint AS last_sale_price_cents,
    NULL::date AS last_sale_date,
    NULL::bigint AS est_loan_low_cents,
    NULL::bigint AS est_loan_high_cents,
    c.tcpa_clear,
    c.human_summary,
    c.buyer_type,
    c.suggested_opener,
    c.provenance_source_urls,
    c.created_at,
    c.city,
    c.state,
    c.zip
   FROM hire_alert_candidates c
UNION ALL
 SELECT s.id::text AS id,
        CASE
            WHEN s.signal_type = ANY (ARRAY['permit_surge'::text, 'demand_signal'::text]) THEN 'demand'::text
            WHEN s.signal_type = ANY (ARRAY['sam_gov_award'::text, 'contract_award'::text]) THEN 'growth'::text
            ELSE 'supply'::text
        END AS product,
    s.signal_type,
    COALESCE(s.signal_strength_tier,
        CASE
            WHEN s.confidence >= 8 THEN 'hot'
            WHEN s.confidence >= 5 THEN 'warm'
            ELSE 'cool'
        END) AS signal_strength_tier,
    s.confidence AS score,
    s.score_percentile,
    s.signal_velocity,
    s.zip_heat_index,
    s.days_on_radar,
    s.nearby_signal_count,
    s.equity_range_low_cents,
    s.equity_range_high_cents,
    s.year_built,
    s.last_sale_price_cents,
    s.last_sale_date,
    s.est_loan_low_cents,
    s.est_loan_high_cents,
    s.tcpa_clear,
    s.human_summary,
    s.buyer_type,
    s.suggested_opener,
    s.provenance_source_urls,
    s.created_at,
    NULL::text AS city,
    NULL::text AS state,
    NULL::text AS zip
   FROM industry_pulse_signals s;

GRANT SELECT ON public.unified_lead_marketplace_view TO anon, authenticated;