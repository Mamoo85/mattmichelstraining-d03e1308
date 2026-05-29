-- Phase 1: collision lock (atomic), ghosting credits, test sinkhole, TCPA, demand_radar_access
ALTER TABLE public.staffing_agency_clients
  ADD COLUMN IF NOT EXISTS is_test_account boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS fast_track_credits integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS demand_radar_access boolean NOT NULL DEFAULT false;

ALTER TABLE public.agency_candidate_assignments
  ADD COLUMN IF NOT EXISTS ghosted_at timestamptz,
  ADD COLUMN IF NOT EXISTS ghost_reason text;

ALTER TABLE public.hire_alert_candidates
  ADD COLUMN IF NOT EXISTS do_not_contact boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS do_not_contact_at timestamptz;

-- Unique constraint on (agency_id, candidate_id) so duplicate distribution is impossible
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agency_candidate_assignments_agency_candidate_unique') THEN
    ALTER TABLE public.agency_candidate_assignments
      ADD CONSTRAINT agency_candidate_assignments_agency_candidate_unique UNIQUE (agency_id, candidate_id);
  END IF;
END $$;

-- Index for fast collision lookups
CREATE INDEX IF NOT EXISTS idx_agency_assignments_candidate_status ON public.agency_candidate_assignments(candidate_id, status);
CREATE INDEX IF NOT EXISTS idx_hire_REDACTED ON public.hire_alert_candidates(do_not_contact) WHERE do_not_contact = true;