-- License gate: healthcare records can't be exported/checked-out without a license #.
CREATE OR REPLACE FUNCTION public.candidate_export_eligible(p_candidate_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c record;
  is_healthcare boolean;
BEGIN
  SELECT id, full_name, name, trade, license_type, license_number, license_state
    INTO c
  FROM public.hire_alert_candidates
  WHERE id = p_candidate_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'not_found');
  END IF;

  is_healthcare := (
    coalesce(c.trade, '') ~* '\b(rn|lpn|cna|nurse|nursing|home\s*health|don)\b'
    OR coalesce(c.license_type, '') ~* '\b(rn|lpn|cna|nurse|nursing|home\s*health|don)\b'
  );

  IF is_healthcare AND (c.license_number IS NULL OR length(trim(c.license_number)) < 4) THEN
    RETURN jsonb_build_object(
      'eligible', false,
      'reason', 'missing_license_number',
      'message', 'Healthcare records require a valid license number on file before they can be exported or sold.',
      'candidate_id', c.id,
      'name', coalesce(c.full_name, c.name),
      'trade', c.trade
    );
  END IF;

  IF is_healthcare AND (c.license_state IS NULL OR length(trim(c.license_state)) < 2) THEN
    RETURN jsonb_build_object(
      'eligible', false,
      'reason', 'missing_license_state',
      'message', 'Healthcare records require a license state (e.g. MI) on file.',
      'candidate_id', c.id,
      'name', coalesce(c.full_name, c.name)
    );
  END IF;

  RETURN jsonb_build_object('eligible', true, 'candidate_id', c.id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.candidate_export_eligible(uuid) TO authenticated, anon;

-- Bulk variant — used by export UI to pre-validate a selection.
CREATE OR REPLACE FUNCTION public.bulk_candidate_export_check(p_candidate_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  results jsonb := '[]'::jsonb;
  blocked_count int := 0;
  rec record;
  check_result jsonb;
BEGIN
  FOR rec IN
    SELECT unnest(p_candidate_ids) AS id
  LOOP
    check_result := public.candidate_export_eligible(rec.id);
    IF (check_result->>'eligible')::boolean = false THEN
      blocked_count := blocked_count + 1;
      results := results || jsonb_build_array(check_result);
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'total_checked', array_length(p_candidate_ids, 1),
    'blocked_count', blocked_count,
    'all_eligible', blocked_count = 0,
    'blocked', results
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.bulk_candidate_export_check(uuid[]) TO authenticated, anon;

-- Performance: speed up the Nursys batch picker.
CREATE INDEX IF NOT EXISTS idx_hire_REDACTED
  ON public.hire_alert_candidates (license_state, license_number)
  WHERE license_number IS NOT NULL
    AND license_state IS NOT NULL
    AND (nursys_enrolled IS NULL OR nursys_enrolled = false);

COMMENT ON FUNCTION public.candidate_export_eligible(uuid) IS
  'Healthcare records (RN/LPN/CNA/nurse/DON) require license_number + license_state before export or checkout. All other trades always pass.';

COMMENT ON FUNCTION public.bulk_candidate_export_check(uuid[]) IS
  'Pre-validates an array of candidate ids for export. Returns blocked count + per-record reason. Used by export UI and create-marketplace-lead-checkout.';