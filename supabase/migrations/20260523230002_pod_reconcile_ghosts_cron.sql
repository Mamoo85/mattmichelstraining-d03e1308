-- Schedule ghost reconciler every 6 hours
DO $migration$
DECLARE
  v_url text := 'https://zmyczlfuufhngzovkjdh.supabase.co';
  -- anon key for secondary project
  v_key text;
  v_hdr text;
BEGIN
  -- Secondary project anon key (zmyczlfuufhngzovkjdh)
  v_key := 'eyJ.REDACTED.JWT';
  v_hdr := json_build_object('Content-Type','application/json','Authorization','Bearer ' || v_key)::text;

  PERFORM cron.unschedule('pod-reconcile-ghosts-6h')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'pod-reconcile-ghosts-6h');

  PERFORM cron.schedule(
    'pod-reconcile-ghosts-6h',
    '0 0,6,12,18 * * *',
    format($job$SELECT net.http_post(url := %L, headers := %L::jsonb, body := '{}'::jsonb);$job$,
      v_url || '/functions/v1/pod-reconcile-ghosts', v_hdr)
  );
END $migration$;
