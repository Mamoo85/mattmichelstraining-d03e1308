REVOKE UPDATE, DELETE, TRUNCATE ON public.trial_funnel_events FROM anon, authenticated, public;

DO $$ BEGIN
  PERFORM cron.unschedule('anniversary-notice-sender-daily');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'anniversary-notice-sender-daily',
  '0 14 * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/anniversary-notice-sender',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY_VAULT')
    ),
    body := '{}'::jsonb
  );
  $cron$
);

INSERT INTO public.contractor_outreach_suppression (contact, contact_type, source, reason)
VALUES ('your@email.com', 'email', 'manual', 'placeholder_address')
ON CONFLICT DO NOTHING;
