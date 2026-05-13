ALTER TABLE public.staffing_agency_prospects
  ADD CONSTRAINT staffing_agency_prospects_email_unique UNIQUE (email);

UPDATE public.staffing_agency_raw_queue q
SET enrichment_status = 'pending',
    notes = COALESCE(NULLIF(q.notes, ''), 'requeued_after_email_unique_fix'),
    updated_at = now()
WHERE q.enrichment_status = 'enriched'
  AND q.resolved_email IS NOT NULL
  AND q.resolved_email <> ''
  AND NOT EXISTS (
    SELECT 1
    FROM public.staffing_agency_prospects p
    WHERE lower(p.email) = lower(q.resolved_email)
  );