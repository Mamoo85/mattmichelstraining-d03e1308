DO $mig$
DECLARE
  v_url text := 'https://eauvubfpanpeuxsrqesu.supabase.co';
  v_key text;
  v_jobs text[] := ARRAY[
    'hire-alert-scanner-daily','hire-alert-phantom-alert-daily','hire-alert-trial-convert-daily',
    'dead-lead-drip-daily','dead-lead-daily-notifier','dead-lead-outreach-drip-daily',
    'contractor-fomo-mailer-daily','contractor-aged-lead-downsell-daily',
    'dwa-operator-4h','dwa-closer-daily',
    'comply-monitor-daily','mute-compliance-2h',
    'storm-lead-blaster','recall-alert-checker','permit-watch-scanner','website-speed-audit',
    'bedtime-story-sender','crime-digest-sender','license-expiry-checker'
  ];
  v_specs text[][] := ARRAY[
    ['hire-alert-scanner-daily','0 11 * * *','hire-alert-scanner'],
    ['hire-alert-phantom-alert-daily','30 12 * * *','hire-alert-phantom-alert'],
    ['hire-alert-trial-convert-daily','0 14 * * *','hire-alert-trial-convert'],
    ['dead-lead-drip-daily','0 14 * * *','dead-lead-drip'],
    ['dead-lead-daily-notifier','0 21 * * *','dead-lead-daily-notifier'],
    ['dead-lead-outreach-drip-daily','0 16 * * *','dead-lead-outreach-drip'],
    ['contractor-fomo-mailer-daily','0 19 * * *','contractor-fomo-mailer'],
    ['contractor-aged-lead-downsell-daily','0 18 * * *','contractor-aged-lead-downsell'],
    ['dwa-operator-4h','0 */4 * * *','dwa-operator'],
    ['dwa-closer-daily','0 18 * * *','dwa-closer'],
    ['comply-monitor-daily','30 15 * * *','comply-monitor'],
    ['mute-compliance-2h','0 */2 * * *','mute-compliance-monitor'],
    ['storm-lead-blaster','*/30 * * * *','storm-lead-blaster'],
    ['recall-alert-checker','0 13 * * *','recall-alert-checker'],
    ['permit-watch-scanner','0 12 * * 1-5','permit-watch-scanner'],
    ['website-speed-audit','0 11 1 * *','website-speed-audit'],
    ['bedtime-story-sender','0 23 * * *','bedtime-story-sender'],
    ['crime-digest-sender','0 12 * * 1','crime-digest-sender'],
    ['license-expiry-checker','0 13 * * *','license-expiry-checker']
  ];
  j text;
  i int;
  v_sql text;
BEGIN
  SELECT decrypted_secret INTO v_key
  FROM vault.decrypted_secrets
  WHERE name = 'SUPABASE_SERVICE_ROLE_KEY_VAULT'
  LIMIT 1;

  IF v_key IS NULL THEN
    RAISE EXCEPTION 'SUPABASE_SERVICE_ROLE_KEY_VAULT missing from vault — aborting';
  END IF;

  FOREACH j IN ARRAY v_jobs LOOP
    BEGIN
      PERFORM cron.unschedule(j);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'cron.unschedule(%) skipped: %', j, SQLERRM;
    END;
  END LOOP;

  FOR i IN 1 .. array_length(v_specs, 1) LOOP
    v_sql := format(
      'SELECT net.http_post(url := %L, headers := jsonb_build_object(%L,%L,%L,%L), body := %L::jsonb)',
      v_url || '/functions/v1/' || v_specs[i][3],
      'Content-Type','application/json',
      'Authorization','Bearer ' || v_key,
      '{}'
    );
    PERFORM cron.schedule(v_specs[i][1], v_specs[i][2], v_sql);
  END LOOP;
END $mig$;