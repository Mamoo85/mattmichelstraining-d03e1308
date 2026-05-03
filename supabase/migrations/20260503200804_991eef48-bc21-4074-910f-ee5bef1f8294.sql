INSERT INTO enrichment_walker_config (key, value_text)
VALUES ('frugal_mode', 'true') ON CONFLICT (key) DO NOTHING;

INSERT INTO enrichment_walker_config (key, value_numeric)
VALUES ('frugal_max_daily_usd', 15) ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE VIEW cold_email_economics_today
WITH (security_invoker = true) AS
WITH spend_today AS (
  SELECT COALESCE(SUM(cost_cents), 0)::bigint AS cents
  FROM lead_enrichment_audit WHERE created_at::date = current_date
),
spend_30d AS (
  SELECT COALESCE(SUM(cost_cents), 0)::bigint AS cents
  FROM lead_enrichment_audit WHERE created_at >= now() - interval '30 days'
),
spend_7d AS (
  SELECT COALESCE(SUM(cost_cents), 0)::bigint AS cents
  FROM lead_enrichment_audit WHERE created_at >= now() - interval '7 days'
),
sent_today AS (
  SELECT COUNT(DISTINCT message_id) AS n
  FROM email_send_log
  WHERE status = 'sent' AND created_at::date = current_date
    AND template_name IN (
      'cold_outreach','multi_service_pitch_1','multi_service_pitch_2','multi_service_pitch_3',
      'web_drip_d1','web_drip_d4','web_drip_d8','web_drip_d15',
      'techalert_cold_outreach','techalert_cold_d0',
      'techalert_followup_d3','techalert_followup_d7','techalert_followup_d14',
      'contractor_drip_d0','contractor_drip_d3','contractor_drip_d7','contractor_drip_d14',
      'dossier_cold_outreach'
    )
),
attributed_mrr AS (
  SELECT (
    COALESCE((
      SELECT COUNT(*) FROM field_crm_clients fc
      WHERE fc.status = 'active' AND fc.email IS NOT NULL
        AND EXISTS (SELECT 1 FROM outreach_leads ol WHERE ol.last_contact_date IS NOT NULL AND lower(ol.email) = lower(fc.email))
    ), 0) * 19900
    + COALESCE((
      SELECT COUNT(*) FROM hire_alert_clients hc
      WHERE hc.active = true AND hc.owner_email IS NOT NULL
        AND EXISTS (SELECT 1 FROM outreach_leads ol WHERE ol.last_contact_date IS NOT NULL AND lower(ol.email) = lower(hc.owner_email))
    ), 0) * 9900
    + COALESCE((
      SELECT COUNT(*) FROM contractor_clients cc
      WHERE cc.active = true AND cc.email IS NOT NULL
        AND EXISTS (SELECT 1 FROM outreach_leads ol WHERE ol.last_contact_date IS NOT NULL AND lower(ol.email) = lower(cc.email))
    ), 0) * 39900
  )::bigint AS cents
)
SELECT
  (SELECT cents FROM spend_today) AS spend_today_cents,
  (SELECT cents FROM spend_7d)    AS spend_7d_cents,
  (SELECT cents FROM spend_30d)   AS spend_30d_cents,
  (SELECT n FROM sent_today)      AS sends_today,
  (SELECT cents FROM attributed_mrr) AS mrr_attributed_cents,
  ((SELECT cents FROM attributed_mrr) >= (SELECT cents FROM spend_30d)) AS mrr_covers_spend;

GRANT SELECT ON cold_email_economics_today TO service_role, authenticated;

CREATE TABLE IF NOT EXISTS cold_email_daily_cost_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  log_date date NOT NULL UNIQUE,
  sends_count integer NOT NULL,
  spend_cents bigint NOT NULL,
  cost_per_send_cents numeric,
  cost_per_150_cents bigint,
  mrr_attributed_cents bigint,
  mrr_covers_spend boolean,
  frugal_mode boolean,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE cold_email_daily_cost_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all" ON cold_email_daily_cost_log;
CREATE POLICY "service_role_all" ON cold_email_daily_cost_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "admin_read" ON cold_email_daily_cost_log;
CREATE POLICY "admin_read" ON cold_email_daily_cost_log
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));