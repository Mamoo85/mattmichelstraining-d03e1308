-- Phase 61: Schedule pod-bestseller-expander weekly (Wednesdays 9am UTC)
-- Finds Etsy listings with >=1 sale in past 30 days, queues missing product type variants
-- Uses etsy_oauth_tokens for Etsy API access

DO $$
DECLARE
  v_url text;
  v_key text;
BEGIN
  SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL';
  SELECT decrypted_secret INTO v_key FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY_VAULT';

  PERFORM cron.unschedule('pod-bestseller-expander-weekly')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'pod-bestseller-expander-weekly');

  PERFORM cron.schedule(
    'pod-bestseller-expander-weekly',
    '0 9 * * 3',
    format(
      $sql$
        SELECT net.http_post(
          url := %L,
          headers := jsonb_build_object(
            'Authorization', 'Bearer ' || %L,
            'Content-Type', 'application/json'
          ),
          body := '{"expand":true,"topN":10}'::jsonb
        )
      $sql$,
      v_url || '/functions/v1/pod-bestseller-expander',
      v_key
    )
  );
END $$;
