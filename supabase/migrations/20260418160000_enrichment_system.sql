-- Autonomous enrichment waterfall — fills gaps in all search tables over time.
-- Runs every 2h via cron; each run processes a small batch so the 150s edge
-- function limit is never hit.

-- ── hire_alert_candidates: enrichment tracking + Sonar columns ──
ALTER TABLE public.hire_alert_candidates
  ADD COLUMN IF NOT EXISTS enrichment_status       text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS enrichment_attempted_at timestamptz,
  ADD COLUMN IF NOT EXISTS sonar_linkedin_url       text,
  ADD COLUMN IF NOT EXISTS sonar_current_employer   text,
  ADD COLUMN IF NOT EXISTS sonar_availability_signal text,
  ADD COLUMN IF NOT EXISTS sonar_enriched_at        timestamptz;

-- Skip low-score + company rows — not worth enriching
UPDATE public.hire_alert_candidates
SET enrichment_status = 'skipped'
WHERE enrichment_status = 'pending'
  AND (score IS NULL OR score < 5 OR is_company_name = true);

-- ── techalert_business_prospects: enrichment + decision-maker contact ──
ALTER TABLE public.techalert_business_prospects
  ADD COLUMN IF NOT EXISTS enrichment_status       text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS enrichment_attempted_at timestamptz,
  ADD COLUMN IF NOT EXISTS contact_name            text,
  ADD COLUMN IF NOT EXISTS sonar_enriched_at       timestamptz;

-- ── b2b_contacts: enrichment tracking ──
ALTER TABLE public.b2b_contacts
  ADD COLUMN IF NOT EXISTS enrichment_status       text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS enrichment_attempted_at timestamptz,
  ADD COLUMN IF NOT EXISTS sonar_enriched_at       timestamptz;

-- Partial indexes — only pending rows scanned by cron, keeps queries fast
CREATE INDEX IF NOT EXISTS idx_candidates_enrichment_queue
  ON public.hire_alert_candidates(score DESC, created_at ASC)
  WHERE enrichment_status = 'pending';

CREATE INDEX IF NOT EXISTS idx_prospects_enrichment_queue
  ON public.techalert_business_prospects(created_at ASC)
  WHERE enrichment_status = 'pending';

CREATE INDEX IF NOT EXISTS idx_b2b_enrichment_queue
  ON public.b2b_contacts(created_at ASC)
  WHERE enrichment_status = 'pending';

-- Cron: enrich-candidates every 2 hours
SELECT cron.schedule(
  'enrich-candidates-2h',
  '0 */2 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/enrich-candidates',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')
    ),
    body := '{}'::jsonb
  );
  $$
);
