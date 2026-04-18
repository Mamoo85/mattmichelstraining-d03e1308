create table if not exists public.ai_call_log (
  id uuid primary key default gen_random_uuid(),
  caller text not null,
  task text not null,
  provider text not null,
  model text not null,
  success boolean not null,
  latency_ms integer,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists ai_call_log_caller_created_idx on public.ai_call_log(caller, created_at desc);
create index if not exists ai_call_log_provider_success_idx on public.ai_call_log(provider, success, created_at desc);

alter table public.ai_call_log enable row level security;

drop policy if exists "service_role manages ai_call_log" on public.ai_call_log;
create policy "service_role manages ai_call_log"
on public.ai_call_log for all
to service_role
using (true) with check (true);

drop policy if exists "admins read ai_call_log" on public.ai_call_log;
create policy "admins read ai_call_log"
on public.ai_call_log for select
to authenticated
using (public.has_role(auth.uid(), 'admin'));