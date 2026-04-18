do $$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    return;
  end if;

  perform cron.unschedule('enrichment-cost-rollup-daily') where exists (
    select 1 from cron.job where jobname = 'enrichment-cost-rollup-daily'
  );

  perform cron.schedule(
    'enrichment-cost-rollup-daily',
    '0 11 * * *',
    $job$
      select net.http_post(
        url := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/enrichment-cost-rollup',
        headers := jsonb_build_object(
          'Content-Type','application/json',
          'Authorization','Bearer '||(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='SUPABASE_SERVICE_ROLE_KEY_VAULT' LIMIT 1)
        ),
        body := '{}'::jsonb
      );
    $job$
  );
end$$;