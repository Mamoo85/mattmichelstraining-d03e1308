
-- Fix 20 broken crons: previous migration referenced vault.decrypted_secrets for SUPABASE_URL/ANON_KEY
-- which don't exist as vault entries (they're env vars only) → URL was NULL → all silently failed.
-- Rewriting with hardcoded URL + anon key (same pattern as working crons like ads-copy-monthly-sender).

DO $$
DECLARE
  fn TEXT;
  jn TEXT;
  sched TEXT;
  jobs TEXT[][] := ARRAY[
    ['boiler-sector-intel-daily',          'boiler-sector-intel',          '0 11 * * *'],
    ['contractor-aged-lead-downsell-daily','contractor-aged-lead-downsell','0 18 * * *'],
    ['contractor-drip-daily',              'contractor-drip',              '0 14 * * *'],
    ['contractor-fomo-mailer-daily',       'contractor-fomo-mailer',       '0 19 * * *'],
    ['contractor-prospector-daily',        'contractor-prospector',        '0 15 * * *'],
    ['contractor-sms-daily',               'contractor-sms-follow',        '30 14 * * *'],
    ['dead-lead-daily-notifier',           'dead-lead-daily-notifier',     '0 21 * * *'],
    ['dead-lead-drip-daily',               'dead-lead-drip',               '0 14 * * *'],
    ['dead-lead-outreach-drip-daily',      'dead-lead-outreach-drip',      '0 16 * * *'],
    ['demand-radar-digest-daily',          'demand-radar-digest',          '0 11 * * *'],
    ['dwa-closer-daily',                   'dwa-closer',                   '0 18 * * *'],
    ['dwa-operator-4h',                    'dwa-operator',                 '0 */4 * * *'],
    ['hire-alert-phantom-alert-daily',     'hire-alert-phantom-alert',     '30 12 * * *'],
    ['hire-alert-scanner-daily',           'hire-alert-scanner',           '0 11 * * *'],
    ['hire-alert-trial-convert-daily',     'hire-alert-trial-convert',     '30 13 * * *'],
    ['industrial-growth-intel-daily',      'industrial-growth-intel',      '0 12 * * *'],
    ['pipeline-health-monitor-morning',    'pipeline-health-monitor',      '0 13 * * *'],
    ['pipeline-health-monitor-evening',    'pipeline-health-monitor',      '0 22 * * *'],
    ['techalert-fielddesk-crosssell-daily','techalert-fielddesk-crosssell','0 17 * * *'],
    ['trojan-horse-upsell-daily',          'trojan-horse-upsell',          '0 16 * * *']
  ];
  i INT;
BEGIN
  FOR i IN 1 .. array_length(jobs, 1) LOOP
    jn    := jobs[i][1];
    fn    := jobs[i][2];
    sched := jobs[i][3];

    -- Unschedule existing broken job (ignore if not found)
    BEGIN
      PERFORM cron.unschedule(jn);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    -- Reschedule with hardcoded URL + anon key (the proven working pattern)
    PERFORM cron.schedule(
      jn,
      sched,
      format($cmd$
        SELECT net.http_post(
          url:='https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/%s',
          headers:='{"Content-Type":"application/json","Authorization":"Bearer eyJ.REDACTED.JWT"}'::jsonb,
          body:='{"source":"cron"}'::jsonb
        ) AS request_id;
      $cmd$, fn)
    );
  END LOOP;
END $$;
