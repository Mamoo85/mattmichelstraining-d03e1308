
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
  -- \m = start of word (Postgres POSIX). Matches name = 'KEY' but not lastname = 'KEY'.
  -- 's' flag = dotall so .*? spans newlines/parens between vault.decrypted_secrets and the predicate.
  FOR v_match IN
    SELECT regexp_matches(
      p_command,
      'vault\.decrypted_secrets.*?\mname\s*=\s*''([^'']+)''',
      'gis'
    )
  LOOP
    v_keys := array_append(v_keys, v_match[1]);
  END LOOP;
  RETURN v_keys;
END;
$$;
