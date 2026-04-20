create table if not exists public.demand_radar_runs (
  id uuid primary key default gen_random_uuid(),
  run_at timestamptz not null default now(),
  source text not null,
  signals_found int not null default 0,
  signals_new int not null default 0,
  errors text,
  status text not null default 'ok',
  duration_ms int
);

create index if not exists demand_radar_runs_run_at_idx on public.demand_radar_runs (run_at desc);
create index if not exists demand_radar_runs_source_idx on public.demand_radar_runs (source, run_at desc);

alter table public.demand_radar_runs enable row level security;

drop policy if exists "Admins can read demand_radar_runs" on public.demand_radar_runs;
create policy "Admins can read demand_radar_runs"
  on public.demand_radar_runs
  for select
  to authenticated
  using (public.has_role(auth.uid(), 'admin'::app_role));

drop policy if exists "Service role full access demand_radar_runs" on public.demand_radar_runs;
create policy "Service role full access demand_radar_runs"
  on public.demand_radar_runs
  for all
  to service_role
  using (true)
  with check (true);
