-- Additive support tables for radar/enrichment cost-reduction.
-- Nothing in production reads or writes to these yet — they exist for opt-in adoption.

create table if not exists public.scrape_raw_cache (
  id uuid primary key default gen_random_uuid(),
  url_hash text not null unique,
  url text not null,
  body jsonb,
  status_code integer,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days')
);
create index if not exists idx_scrape_raw_cache_expires on public.scrape_raw_cache (expires_at);
alter table public.scrape_raw_cache enable row level security;
create policy "service_role_all_scrape_raw_cache" on public.scrape_raw_cache for all to service_role using (true) with check (true);

create table if not exists public.scrape_errors (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  url text not null,
  error_message text,
  status_code integer,
  retry_count integer not null default 0,
  next_retry_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists idx_scrape_errors_pending on public.scrape_errors (next_retry_at) where resolved_at is null;
create index if not exists idx_scrape_errors_source on public.scrape_errors (source, created_at desc);
alter table public.scrape_errors enable row level security;
create policy "service_role_all_scrape_errors" on public.scrape_errors for all to service_role using (true) with check (true);

create table if not exists public.pdl_negative_cache (
  id uuid primary key default gen_random_uuid(),
  lookup_key text not null unique,
  reason text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '90 days')
);
create index if not exists idx_pdl_negative_expires on public.pdl_negative_cache (expires_at);
alter table public.pdl_negative_cache enable row level security;
create policy "service_role_all_pdl_negative" on public.pdl_negative_cache for all to service_role using (true) with check (true);

create table if not exists public.daily_metrics (
  id uuid primary key default gen_random_uuid(),
  metric_date date not null,
  metric_name text not null,
  metric_value numeric not null,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (metric_date, metric_name)
);
create index if not exists idx_daily_metrics_date on public.daily_metrics (metric_date desc);
create index if not exists idx_daily_metrics_name_date on public.daily_metrics (metric_name, metric_date desc);
alter table public.daily_metrics enable row level security;
create policy "service_role_all_daily_metrics" on public.daily_metrics for all to service_role using (true) with check (true);

create table if not exists public.llm_response_cache (
  id uuid primary key default gen_random_uuid(),
  prompt_hash text not null unique,
  model text not null,
  response jsonb not null,
  hit_count integer not null default 1,
  created_at timestamptz not null default now(),
  last_hit_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days')
);
create index if not exists idx_llm_cache_expires on public.llm_response_cache (expires_at);
create index if not exists idx_llm_cache_model on public.llm_response_cache (model, created_at desc);
alter table public.llm_response_cache enable row level security;
create policy "service_role_all_llm_cache" on public.llm_response_cache for all to service_role using (true) with check (true);

-- Add cost_usd column to ai_call_log for #20 (additive — existing INSERTs continue to work)
alter table public.ai_call_log add column if not exists cost_usd numeric(10, 6);

-- Schedule nightly VACUUM ANALYZE on the heaviest enrichment tables (#46)
-- pg_cron syntax — guarded so it doesn't error if cron extension is missing
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('vacuum-enrichment-tables-nightly') where exists (
      select 1 from cron.job where jobname = 'vacuum-enrichment-tables-nightly'
    );
    perform cron.schedule(
      'vacuum-enrichment-tables-nightly',
      '0 9 * * *',  -- 9am UTC = 4am ET, low-traffic window
      $cron$
        vacuum analyze public.hire_alert_candidates;
        vacuum analyze public.hire_alert_client_candidates;
        vacuum analyze public.industry_pulse_signals;
        vacuum analyze public.demand_radar_signals;
        vacuum analyze public.ai_call_log;
        vacuum analyze public.candidate_enrichment_log;
        delete from public.scrape_raw_cache where expires_at < now();
        delete from public.pdl_negative_cache where expires_at < now();
        delete from public.llm_response_cache where expires_at < now();
      $cron$
    );
  end if;
end$$;