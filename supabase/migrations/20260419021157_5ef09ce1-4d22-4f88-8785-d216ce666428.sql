-- Phase 17 cleanup: kill the broken lara-fast-scanner-30min cron.
-- 41/41 failures in 48h due to NULL url (vault-lookup pattern that the project memory bans).
-- The 4-hour main scanner already covers this source range with the approved hardcoded URL pattern.
DO $migration$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'lara-fast-scanner-30min') THEN
    PERFORM cron.unschedule('lara-fast-scanner-30min');
  END IF;
END $migration$;