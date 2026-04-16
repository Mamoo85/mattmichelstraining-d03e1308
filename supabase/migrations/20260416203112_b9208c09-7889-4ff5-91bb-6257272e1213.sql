-- Agency cron schedules + minor schema additions for territory lock tracking

-- Add card_saved_at + annual_prepay tracking columns (nullable so existing rows are safe)
ALTER TABLE public.staffing_agency_clients
  ADD COLUMN IF NOT EXISTS card_saved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS annual_prepay_paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS annual_prepay_expires_at TIMESTAMPTZ;

-- Schedule the agency cron jobs using vault.decrypted_secrets pattern
DO $$
DECLARE
  supabase_url TEXT;
  service_key TEXT;
BEGIN
  SELECT decrypted_secret INTO supabase_url FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1;
  SELECT decrypted_secret INTO service_key FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1;

  IF supabase_url IS NOT NULL AND service_key IS NOT NULL THEN
    -- Distribute candidates daily 7am ET (11am UTC); function adds its own jitter
    PERFORM cron.unschedule('agency-distribute-candidates-daily') WHERE EXISTS (
      SELECT 1 FROM cron.job WHERE jobname = 'agency-distribute-candidates-daily'
    );
    PERFORM cron.schedule(
      'agency-distribute-candidates-daily',
      '0 11 * * *',
      format($cron$
        SELECT net.http_post(
          url:=%L,
          headers:=%L::jsonb,
          body:='{"trigger":"cron"}'::jsonb
        );
      $cron$,
        supabase_url || '/functions/v1/agency-distribute-candidates',
        '{"Content-Type":"application/json","Authorization":"Bearer ' || service_key || '"}'
      )
    );

    -- Monthly flip check on 1st of month, 1pm UTC (9am ET)
    PERFORM cron.unschedule('agency-monthly-flip') WHERE EXISTS (
      SELECT 1 FROM cron.job WHERE jobname = 'agency-monthly-flip'
    );
    PERFORM cron.schedule(
      'agency-monthly-flip',
      '0 13 1 * *',
      format($cron$
        SELECT net.http_post(
          url:=%L,
          headers:=%L::jsonb,
          body:='{"trigger":"cron"}'::jsonb
        );
      $cron$,
        supabase_url || '/functions/v1/agency-monthly-flip',
        '{"Content-Type":"application/json","Authorization":"Bearer ' || service_key || '"}'
      )
    );

    -- Proof Drop 48h follow-up daily 2pm UTC (10am ET)
    PERFORM cron.unschedule('agency-proof-drop-followup-daily') WHERE EXISTS (
      SELECT 1 FROM cron.job WHERE jobname = 'agency-proof-drop-followup-daily'
    );
    PERFORM cron.schedule(
      'agency-proof-drop-followup-daily',
      '0 14 * * *',
      format($cron$
        SELECT net.http_post(
          url:=%L,
          headers:=%L::jsonb,
          body:='{"trigger":"cron"}'::jsonb
        );
      $cron$,
        supabase_url || '/functions/v1/agency-proof-drop-followup',
        '{"Content-Type":"application/json","Authorization":"Bearer ' || service_key || '"}'
      )
    );
  END IF;
END $$;