-- ============================================================
-- SECURITY DEFINER / search_path HARDENING — 2026-04-22
-- ============================================================
-- Audit summary:
--   Public views:                    9 (all already security_invoker=true) ✅
--   SECURITY DEFINER functions:    ~80 (all already have search_path set) ✅
--   Functions missing search_path:   8 (fixed below)
-- ============================================================

ALTER FUNCTION public.candidates_within_radius(double precision, double precision, double precision, integer, integer)
  SET search_path = public;
ALTER FUNCTION public.check_contactability_complete(text, text, text)
  SET search_path = public;
ALTER FUNCTION public.compute_freshness_score(timestamp with time zone, double precision)
  SET search_path = public;
ALTER FUNCTION public.dedup_candidates_fuzzy(text, text, double precision)
  SET search_path = public;
ALTER FUNCTION public.hire_alert_candidates_search_trigger()
  SET search_path = public;
ALTER FUNCTION public.industry_pulse_signals_search_trigger()
  SET search_path = public;
ALTER FUNCTION public.match_signals_semantic(vector, double precision, integer, text)
  SET search_path = public;
ALTER FUNCTION public.search_candidates_hybrid(text, vector, text, text, integer, integer)
  SET search_path = public;

-- Guardrail: reject any future public view without security_invoker=true.
-- (CREATE VIEW tag fires for both CREATE and CREATE OR REPLACE VIEW.)
CREATE OR REPLACE FUNCTION public.enforce_security_invoker_views()
RETURNS event_trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT * FROM pg_event_trigger_ddl_commands()
    WHERE command_tag = 'CREATE VIEW'
      AND schema_name = 'public'
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c
      WHERE c.oid = r.objid
        AND c.reloptions IS NOT NULL
        AND 'security_invoker=true' = ANY(c.reloptions)
    ) THEN
      RAISE EXCEPTION 'View %.% must be created WITH (security_invoker = true) — prevents RLS bypass. Add: ALTER VIEW % SET (security_invoker = true);',
        r.schema_name, r.object_identity, r.object_identity;
    END IF;
  END LOOP;
END;
$$;

DROP EVENT TRIGGER IF EXISTS enforce_invoker_views;
CREATE EVENT TRIGGER enforce_invoker_views
  ON ddl_command_end
  WHEN TAG IN ('CREATE VIEW')
  EXECUTE FUNCTION public.enforce_security_invoker_views();

COMMENT ON EVENT TRIGGER enforce_invoker_views IS
  'Rejects any new view in public schema that does not set security_invoker=true. Prevents accidental RLS bypass via definer-default views.';