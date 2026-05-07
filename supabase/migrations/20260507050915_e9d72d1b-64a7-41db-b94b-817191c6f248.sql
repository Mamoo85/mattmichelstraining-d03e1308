DO $$
DECLARE
  v_url text := 'https://eauvubfpanpeuxsrqesu.supabase.co';
  v_key text;
  jobs text[][] := ARRAY[
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
  j text[];
BEGIN
  SELECT decrypted_secret INTO v_key FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key' LIMIT 1;
  IF v_key IS NULL OR length(v_key) < 100 THEN
    RAISE EXCEPTION 'service-role vault key missing or invalid';
  END IF;

  FOREACH j SLICE 1 IN ARRAY jobs LOOP
    BEGIN PERFORM cron.unschedule(j[1]); EXCEPTION WHEN OTHERS THEN NULL; END;
    PERFORM cron.schedule(
      j[1], j[2],
      format($q$SELECT net.http_post(url := %L, headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer %s'), body := '{}'::jsonb)$q$,
        v_url || '/functions/v1/' || j[3], v_key)
    );
  END LOOP;
END $$;

DROP POLICY IF EXISTS no_anon_insert ON public.trial_funnel_events;
CREATE POLICY no_anon_insert ON public.trial_funnel_events FOR INSERT TO anon WITH CHECK (false);