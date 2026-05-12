DO $$
DECLARE
  v_url text := 'https://eauvubfpanpeuxsrqesu.supabase.co';
  v_auth text := $auth$'Bearer ' || COALESCE(
    (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1),
    (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1),
    (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY_VAULT' LIMIT 1),
    ''
  )$auth$;
  jobs text[] := ARRAY[
    'hire-alert-scanner-daily|0 11 * * *|hire-alert-scanner',
    'hire-alert-phantom-alert-daily|30 12 * * *|hire-alert-phantom-alert',
    'hire-alert-trial-convert-daily|0 14 * * *|hire-alert-trial-convert',
    'dead-lead-drip-daily|0 14 * * *|dead-lead-drip',
    'dead-lead-daily-notifier|0 21 * * *|dead-lead-daily-notifier',
    'dead-lead-outreach-drip-daily|0 16 * * *|dead-lead-outreach-drip',
    'contractor-fomo-mailer-daily|0 19 * * *|contractor-fomo-mailer',
    'contractor-aged-lead-downsell-daily|0 18 * * *|contractor-aged-lead-downsell',
    'dwa-operator-4h|0 */4 * * *|dwa-operator',
    'dwa-closer-daily|0 18 * * *|dwa-closer',
    'comply-monitor-daily|30 15 * * *|comply-monitor'
  ];
  rec text;
  parts text[];
  v_jobname text;
  v_schedule text;
  v_fname text;
  v_cmd text;
BEGIN
  FOREACH rec IN ARRAY jobs LOOP
    parts := string_to_array(rec, '|');
    v_jobname := parts[1]; v_schedule := parts[2]; v_fname := parts[3];
    IF EXISTS (SELECT 1 FROM cron.job j WHERE j.jobname = v_jobname) THEN
      PERFORM cron.unschedule(v_jobname);
    END IF;
    v_cmd := format(
      'SELECT net.http_post(url := %L, headers := jsonb_build_object(''Content-Type'',''application/json'',''Authorization'',%s), body := ''{}''::jsonb);',
      v_url || '/functions/v1/' || v_fname,
      v_auth
    );
    PERFORM cron.schedule(v_jobname, v_schedule, v_cmd);
  END LOOP;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'trial_funnel_events') THEN
    EXECUTE 'ALTER TABLE public.trial_funnel_events ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS no_anon_insert ON public.trial_funnel_events';
    EXECUTE 'CREATE POLICY no_anon_insert ON public.trial_funnel_events FOR INSERT TO anon WITH CHECK (false)';
  END IF;
END $$;