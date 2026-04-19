-- 1. Clean up the corrupted historical rows
UPDATE public.hire_alert_candidates
SET phone = NULL
WHERE phone IN ('true','false','True','False','TRUE','FALSE');

UPDATE public.hire_alert_candidates
SET email = NULL
WHERE email IN ('true','false','True','False','TRUE','FALSE');

-- 2. Permanent guard: trigger that nulls out boolean-string contamination on insert/update
CREATE OR REPLACE FUNCTION public.scrub_boolean_contact_strings()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.phone IS NOT NULL AND lower(NEW.phone) IN ('true','false') THEN
    NEW.phone := NULL;
  END IF;
  IF NEW.email IS NOT NULL AND lower(NEW.email) IN ('true','false') THEN
    NEW.email := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS scrub_contact_strings_trg ON public.hire_alert_candidates;
CREATE TRIGGER scrub_contact_strings_trg
BEFORE INSERT OR UPDATE ON public.hire_alert_candidates
FOR EACH ROW
EXECUTE FUNCTION public.scrub_boolean_contact_strings();

-- 3. Speed up dashboard filtering (companies excluded, ordered by score)
CREATE INDEX IF NOT EXISTS idx_candidates_company_score
  ON public.hire_alert_candidates (is_company_name, availability_score DESC)
  WHERE is_company_name = false;

-- 4. Add the missing last_error column for scanner observability
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='hire_alert_scanner_checkpoints') THEN
    ALTER TABLE public.hire_alert_scanner_checkpoints
      ADD COLUMN IF NOT EXISTS last_error TEXT;
  END IF;
END
$$;