-- Kill the cold-SMS-to-scraped-contractors cron. We don't cold-text — TCPA exposure.
-- Email outreach (web-design-drip, prospector) stays. SMS is for opted-in customers only.
DO $$
BEGIN
  PERFORM cron.unschedule('contractor-sms-daily');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('contractor-sms-follow-daily');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;