
-- Helper: check if a vault secret exists AND is non-empty (SECURITY DEFINER bypasses RLS on vault schema)
CREATE OR REPLACE FUNCTION public._vault_key_exists(p_name text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, vault
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM vault.decrypted_secrets
    WHERE name = p_name
      AND decrypted_secret IS NOT NULL
      AND length(decrypted_secret) > 0
  );
$$;

REVOKE ALL ON FUNCTION public._vault_key_exists(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._vault_key_exists(text) TO postgres, service_role;

-- Helper: extract every vault.decrypted_secrets key name referenced in a SQL command
CREATE OR REPLACE FUNCTION public._extract_vault_keys(p_command text)
RETURNS text[]
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_keys text[] := ARRAY[]::text[];
  v_match text[];
BEGIN
  -- Match: vault.decrypted_secrets ... WHERE name = 'KEY' OR name='KEY' (single or double quoted, any whitespace)
  FOR v_match IN
    SELECT regexp_matches(
      p_command,
      'vault\.decrypted_secrets[^;]*?\bname\s*=\s*''([^'']+)''',
      'gi'
    )
  LOOP
    v_keys := array_append(v_keys, v_match[1]);
  END LOOP;
  RETURN v_keys;
END;
$$;

-- Patch safe_cron_validate to also enforce vault-key existence
CREATE OR REPLACE FUNCTION public.safe_cron_validate(
  p_jobname text,
  p_schedule text,
  p_command text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_keys text[];
  v_key text;
  v_existing record;
  v_result jsonb;
BEGIN
  -- Rule: jobname required
  IF p_jobname IS NULL OR length(trim(p_jobname)) = 0 THEN
    v_result := jsonb_build_object('ok', false, 'rule', 'jobname_required', 'error', 'jobname must be non-empty');
    INSERT INTO public.cron_schedule_audit(jobname, mode, outcome, error_rule, error_message, attempted_by, schedule, command)
    VALUES (p_jobname, 'validate', 'rejected', 'jobname_required', 'jobname must be non-empty', current_user, p_schedule, p_command);
    RETURN v_result;
  END IF;

  -- Rule: schedule must be 5-field cron
  IF p_schedule IS NULL OR array_length(string_to_array(trim(p_schedule), ' '), 1) <> 5 THEN
    v_result := jsonb_build_object('ok', false, 'rule', 'schedule_invalid', 'error', 'schedule must be 5 space-separated fields');
    INSERT INTO public.cron_schedule_audit(jobname, mode, outcome, error_rule, error_message, attempted_by, schedule, command)
    VALUES (p_jobname, 'validate', 'rejected', 'schedule_invalid', 'schedule must be 5 space-separated fields', current_user, p_schedule, p_command);
    RETURN v_result;
  END IF;

  -- Rule: ban current_setting('app.supabase_url')
  IF p_command ~* 'current_setting\s*\(\s*''app\.supabase_url''' THEN
    v_result := jsonb_build_object('ok', false, 'rule', 'banned_app_setting', 'error', 'current_setting(''app.supabase_url'') returns NULL in pg_cron context');
    INSERT INTO public.cron_schedule_audit(jobname, mode, outcome, error_rule, error_message, attempted_by, schedule, command)
    VALUES (p_jobname, 'validate', 'rejected', 'banned_app_setting', 'current_setting(''app.supabase_url'') returns NULL in pg_cron context', current_user, p_schedule, p_command);
    RETURN v_result;
  END IF;

  -- 🆕 Rule: every vault key referenced MUST exist and be non-empty
  v_keys := public._extract_vault_keys(p_command);
  FOREACH v_key IN ARRAY v_keys LOOP
    IF NOT public._vault_key_exists(v_key) THEN
      v_result := jsonb_build_object(
        'ok', false,
        'rule', 'vault_key_missing',
        'error', format('vault.decrypted_secrets has no non-empty entry for name=%L. Cron would fire with NULL — refusing to schedule.', v_key),
        'missing_key', v_key
      );
      INSERT INTO public.cron_schedule_audit(jobname, mode, outcome, error_rule, error_message, attempted_by, schedule, command)
      VALUES (p_jobname, 'validate', 'rejected', 'vault_key_missing',
              format('Missing/empty vault key: %s', v_key),
              current_user, p_schedule, p_command);
      RETURN v_result;
    END IF;
  END LOOP;

  -- Rule: must hit canonical project URL OR pull from vault (vault path now validated above)
  IF p_command !~* 'eauvubfpanpeuxsrqesu\.supabase\.co'
     AND p_command !~* 'vault\.decrypted_secrets' THEN
    v_result := jsonb_build_object('ok', false, 'rule', 'missing_canonical_url', 'error', 'command must reference https://eauvubfpanpeuxsrqesu.supabase.co or pull URL from vault');
    INSERT INTO public.cron_schedule_audit(jobname, mode, outcome, error_rule, error_message, attempted_by, schedule, command)
    VALUES (p_jobname, 'validate', 'rejected', 'missing_canonical_url', 'command must reference canonical URL or vault', current_user, p_schedule, p_command);
    RETURN v_result;
  END IF;

  -- Rule: literal NULL url
  IF p_command ~* 'url\s*:?=\s*NULL' OR p_command ~* 'Bearer\s+NULL' THEN
    v_result := jsonb_build_object('ok', false, 'rule', 'literal_null', 'error', 'command contains literal NULL url or Bearer NULL');
    INSERT INTO public.cron_schedule_audit(jobname, mode, outcome, error_rule, error_message, attempted_by, schedule, command)
    VALUES (p_jobname, 'validate', 'rejected', 'literal_null', 'literal NULL url or Bearer NULL', current_user, p_schedule, p_command);
    RETURN v_result;
  END IF;

  -- Success: log + report what would replace
  SELECT jobname, schedule INTO v_existing FROM cron.job WHERE jobname = p_jobname;
  v_result := jsonb_build_object(
    'ok', true,
    'would_replace', v_existing IS NOT NULL,
    'new', jsonb_build_object('jobname', p_jobname, 'schedule', p_schedule),
    'vault_keys_validated', v_keys
  );
  INSERT INTO public.cron_schedule_audit(jobname, mode, outcome, attempted_by, schedule, command)
  VALUES (p_jobname, 'validate', 'success', current_user, p_schedule, p_command);
  RETURN v_result;
END;
$$;

-- Add 'vault_key_missing' to allowed error_rule values if there's a check constraint
-- (no-op if constraint doesn't restrict)

COMMENT ON FUNCTION public._vault_key_exists IS 'Returns true if vault has a non-empty secret with the given name. Used by safe_cron_validate.';
COMMENT ON FUNCTION public._extract_vault_keys IS 'Extracts all vault.decrypted_secrets key names referenced in a SQL command via regex.';
