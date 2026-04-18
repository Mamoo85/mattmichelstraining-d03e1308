do $$
declare
  supa_url text;
  supa_anon text;
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    return;
  end if;

  select decrypted_secret into supa_url from vault.decrypted_secrets where name = 'SUPABASE_URL' limit 1;
  select decrypted_secret into supa_anon from vault.decrypted_secrets where name = 'SUPABASE_ANON_KEY' limit 1;

  if supa_url is null or supa_anon is null then
    raise notice 'Skipping cron schedule — vault secrets not present';
    return;
  end if;

  perform cron.unschedule('enrichment-cost-rollup-daily') where exists (
    select 1 from cron.job where jobname = 'enrichment-cost-rollup-daily'
  );

  perform cron.schedule(
    'enrichment-cost-rollup-daily',
    '0 11 * * *',
    format(
      $job$
        select net.http_post(
          url := %L || '/functions/v1/enrichment-cost-rollup',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || %L
          ),
          body := '{}'::jsonb
        );
      $job$,
      supa_url,
      supa_anon
    )
  );
end$$;