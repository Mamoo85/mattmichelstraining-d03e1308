create table if not exists sales_script_clients (
  id uuid primary key default gen_random_uuid(),
  business_name text not null,
  contact_name text,
  email text not null unique,
  industry text,
  script_count int default 0,
  last_sent_at timestamptz,
  stripe_subscription_id text,
  active boolean default false,
  created_at timestamptz default now()
);

alter table sales_script_clients enable row level security;

create policy "service_role_all" on sales_script_clients
  for all using (true) with check (true);
