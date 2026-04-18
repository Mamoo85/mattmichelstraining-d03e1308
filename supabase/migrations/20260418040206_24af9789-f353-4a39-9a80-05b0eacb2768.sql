UPDATE public.hire_alert_candidates
SET enrichment_status = 'pending'
WHERE (is_company_name IS NOT TRUE)
  AND (email IS NULL OR email = '')
  AND (phone IS NULL OR phone = '')
  AND enrichment_status IN ('complete','exhausted');