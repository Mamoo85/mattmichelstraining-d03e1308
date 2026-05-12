DO $$
DECLARE
  v_url text := 'https://eauvubfpanpeuxsrqesu.supabase.co';
  v_key text;
BEGIN
  SELECT decrypted_secret INTO v_key
  FROM vault.decrypted_secrets
  WHERE name = 'SUPABASE_SERVICE_ROLE_KEY_VAULT'
  LIMIT 1;

  BEGIN
    PERFORM cron.unschedule('techalert-healthcare-scanner-daily');
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  PERFORM cron.schedule(
    'techalert-healthcare-scanner-daily',
    '0 13 * * *',
    format(
      $f$SELECT net.http_post(url := %L, headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer %s'), body := '{}'::jsonb)$f$,
      v_url || '/functions/v1/techalert-healthcare-scanner',
      v_key
    )
  );
END $$;

ALTER TABLE public.techalert_prospect_targets
  DROP CONSTRAINT IF EXISTS uq_prospect_company_role;

ALTER TABLE public.techalert_prospect_targets
  ADD CONSTRAINT uq_prospect_company_role
  UNIQUE (company_name, role);