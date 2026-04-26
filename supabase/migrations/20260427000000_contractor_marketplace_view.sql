-- contractor_leads_marketplace: public read-only view for the pay-per-lead storefront.
-- No PII exposed — name/phone/email only visible post-payment via LeadUnlocked.
CREATE OR REPLACE VIEW public.contractor_leads_marketplace AS
SELECT
  cl.id,
  cls.trade,
  cls.city,
  cl.project_type,
  cl.quality_score,
  cl.lead_tier,
  cl.estimated_home_value,
  cl.ownership_years,
  cl.identity_verified,
  cl.email_deliverable,
  cl.created_at,
  CASE WHEN cl.lock_expires_at > now() THEN true ELSE false END AS is_locked
FROM public.contractor_leads cl
JOIN public.contractor_lead_sites cls ON cls.id = cl.site_id
WHERE cl.paid_by_contractor_id IS NULL
  AND cl.status IN ('new', 'notified')
  AND cl.created_at > now() - interval '60 days';

GRANT SELECT ON public.contractor_leads_marketplace TO anon, authenticated;
