UPDATE techalert_prospect_targets
SET enriched_at = NULL, notes = NULL
WHERE enriched_at IS NOT NULL
  AND owner_email IS NULL
  AND outreach_status IS NULL;