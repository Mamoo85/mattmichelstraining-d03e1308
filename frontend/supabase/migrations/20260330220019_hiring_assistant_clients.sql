create table if not exists hiring_assistant_clients (
  id uuid primary key default gen_random_uuid(),
  business_name text not null,
  contact_name text,
  email text not null unique,
  industry text,
  city text,
  positions_filled int default 0,
  stripe_subscription_id text,
  active boolean default false,
  created_at timestamptz default now()
);

alter table hiring_assistant_clients enable row level security;

create policy "service_role_all" on hiring_assistant_clients
  for all using (true) with check (true);
