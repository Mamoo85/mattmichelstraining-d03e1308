-- Schedule etsy-stl-publisher at 3am UTC daily
-- Publishes one STL digital download listing per day to Etsy + Gumroad
-- Targets SECONDARY project (zmyczlfuufhngzovkjdh) — that's where etsy_oauth_tokens lives
DO $migration$
DECLARE
  v_url text := 'https://zmyczlfuufhngzovkjdh.supabase.co';
  v_key text := 'eyJ.REDACTED.JWT';
  v_hdr text;
BEGIN
  v_hdr := json_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer ' || v_key
  )::text;

  PERFORM cron.unschedule('etsy-stl-publisher-3am')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'etsy-stl-publisher-3am');

  PERFORM cron.schedule(
    'etsy-stl-publisher-3am',
    '0 3 * * *',
    format(
      $job$SELECT net.http_post(url := %L, headers := %L::jsonb, body := '{}'::jsonb);$job$,
      v_url || '/functions/v1/etsy-stl-publisher',
      v_hdr
    )
  );
END $migration$;
