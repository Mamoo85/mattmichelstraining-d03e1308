-- Auto-expire one-time snapshot unlocks after their week_start window closes
CREATE OR REPLACE FUNCTION public.expire_industrial_pulse_snapshots()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected integer;
BEGIN
  UPDATE public.industrial_pulse_unlocks
     SET status = 'expired',
         canceled_at = COALESCE(canceled_at, now())
   WHERE plan = 'snapshot_50'
     AND status = 'active'
     AND week_start IS NOT NULL
     AND week_start < (CURRENT_DATE - INTERVAL '7 days');
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

-- Run once now to backfill
SELECT public.expire_industrial_pulse_snapshots();

-- Schedule daily 6:00 AM ET (10:00 UTC) — drop existing if present
DO $$
BEGIN
  PERFORM cron.unschedule('expire-industrial-pulse-snapshots-daily')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'expire-industrial-pulse-snapshots-daily');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'expire-industrial-pulse-snapshots-daily',
  '0 10 * * *',
  $$ SELECT public.expire_industrial_pulse_snapshots(); $$
);