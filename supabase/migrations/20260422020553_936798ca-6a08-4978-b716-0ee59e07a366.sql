
CREATE OR REPLACE FUNCTION public._extract_vault_keys(p_command text)
RETURNS text[]
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_keys text[] := ARRAY[]::text[];
  v_match text[];
BEGIN
  -- Match any 'name = ''KEY''' predicate that appears anywhere after a vault.decrypted_secrets reference.
  -- Uses lazy .*? with 's' (dotall) flag so newlines/parens don't break the match.
  FOR v_match IN
    SELECT regexp_matches(
      p_command,
      'vault\.decrypted_secrets.*?\bname\s*=\s*''([^'']+)''',
      'gis'
    )
  LOOP
    v_keys := array_append(v_keys, v_match[1]);
  END LOOP;
  RETURN v_keys;
END;
$$;
