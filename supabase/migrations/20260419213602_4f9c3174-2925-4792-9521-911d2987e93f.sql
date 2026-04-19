CREATE UNIQUE INDEX IF NOT EXISTS hire_alert_candidates_license_number_unique
  ON public.hire_alert_candidates (license_number)
  WHERE license_number IS NOT NULL;