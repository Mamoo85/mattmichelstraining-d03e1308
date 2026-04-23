create table if not exists public.strategy_mode_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  system_prompt text not null,
  audit_checklist text not null default '',
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.strategy_mode_templates enable row level security;

create policy "service role bypass strategy_mode_templates"
  on public.strategy_mode_templates
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "admins can manage strategy_mode_templates"
  on public.strategy_mode_templates
  for all
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create index if not exists idx_strategy_mode_templates_created_at
  on public.strategy_mode_templates(created_at desc);