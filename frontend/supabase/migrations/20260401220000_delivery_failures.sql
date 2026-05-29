create table if not exists delivery_failures (
  id uuid primary key default gen_random_uuid(),
  function_name text not null,
  customer_email text,
  error_message text,
  metadata jsonb,
  created_at timestamptz not null default now()
);
alter table delivery_failures enable row level security;
create policy "service_role_all" on delivery_failures
  for all to service_role using (true) with check (true);
create index on delivery_failures(created_at desc);
