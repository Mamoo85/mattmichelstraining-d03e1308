DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'mortgage-radar-digest-daily') THEN
    PERFORM cron.unschedule('mortgage-radar-digest-daily');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'mortgage-radar-digest') THEN
    PERFORM cron.unschedule('mortgage-radar-digest');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'mortgage-radar-weekly-digest') THEN
    PERFORM cron.unschedule('mortgage-radar-weekly-digest');
  END IF;
END$$;