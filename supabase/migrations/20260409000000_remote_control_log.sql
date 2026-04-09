create table if not exists public.remote_control_log (
  id uuid primary key default gen_random_uuid(),
  command text not null,
  result_snippet text,
  executed_at timestamptz not null default now()
);

alter table public.remote_control_log enable row level security;

create policy "service_role_bypass" on public.remote_control_log
  using (true)
  with check (true);
