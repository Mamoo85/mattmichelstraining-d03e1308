-- Restore trial-funnel event capture without re-opening anon INSERT on the base table.
-- Anon block stays in place; events flow through a SECURITY DEFINER RPC that validates payload.

CREATE OR REPLACE FUNCTION public.log_trial_funnel_event(
  p_event_type text,
  p_product    text DEFAULT NULL,
  p_email      text DEFAULT NULL,
  p_session_id text DEFAULT NULL,
  p_metadata   jsonb DEFAULT '{}'::jsonb,
  p_utm        jsonb DEFAULT '{}'::jsonb,
  p_user_agent text DEFAULT NULL,
  p_referrer   text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  allowed_events constant text[] := ARRAY[
    'view',
    'picker_view',
    'picker_select',
    'form_focus',
    'form_submit',
    'form_submit_failure',
    'checkout_redirect',
    'trial_success',
    'trial_error',
    'escape_hatch_click',
    'sticky_cta_click'
  ];
BEGIN
  IF p_event_type IS NULL OR NOT (p_event_type = ANY(allowed_events)) THEN
    RETURN;
  END IF;

  INSERT INTO public.trial_funnel_events (
    event_type, product, email, session_id, metadata, utm, user_agent, referrer
  ) VALUES (
    p_event_type,
    NULLIF(left(coalesce(p_product, ''), 80), ''),
    NULLIF(lower(trim(coalesce(p_email, ''))), ''),
    NULLIF(left(coalesce(p_session_id, ''), 80), ''),
    coalesce(p_metadata, '{}'::jsonb),
    coalesce(p_utm, '{}'::jsonb),
    NULLIF(left(coalesce(p_user_agent, ''), 500), ''),
    NULLIF(left(coalesce(p_referrer, ''), 500), '')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.log_trial_funnel_event(text,text,text,text,jsonb,jsonb,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_trial_funnel_event(text,text,text,text,jsonb,jsonb,text,text) TO anon, authenticated;