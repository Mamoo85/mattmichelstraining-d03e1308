CREATE OR REPLACE FUNCTION public.burn_fast_track_credit(p_agency_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated_id uuid;
BEGIN
  UPDATE public.staffing_agency_clients
  SET fast_track_credits = fast_track_credits - 1
  WHERE id = p_agency_id
    AND COALESCE(fast_track_credits, 0) > 0
  RETURNING id INTO v_updated_id;

  RETURN v_updated_id IS NOT NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.burn_fast_track_credit(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.burn_fast_track_credit(uuid) TO service_role;