
-- Add is_company_name flag
ALTER TABLE public.hire_alert_candidates 
ADD COLUMN IF NOT EXISTS is_company_name boolean DEFAULT false;

-- Quarantine existing company-name records
UPDATE public.hire_alert_candidates 
SET status = 'quarantined', is_company_name = true
WHERE (
  full_name ~* '\y(and|comfort|zone|supreme|keitz|marvin|son)\y'
  OR full_name ~* '(llc|inc|corp|heating|cooling|&)'
  OR (full_name = upper(full_name) AND length(full_name) > 8)
)
AND status IS DISTINCT FROM 'quarantined';

-- Index for faster filtering
CREATE INDEX IF NOT EXISTS idx_hire_REDACTED 
ON public.hire_alert_candidates (score DESC, created_at DESC) 
WHERE status IS DISTINCT FROM 'quarantined' AND is_company_name = false;
