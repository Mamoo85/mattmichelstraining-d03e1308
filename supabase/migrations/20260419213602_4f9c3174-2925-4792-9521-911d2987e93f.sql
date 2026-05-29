CREATE UNIQUE INDEX IF NOT EXISTS hire_REDACTED
  ON public.hire_alert_candidates (license_number)
  WHERE license_number IS NOT NULL;