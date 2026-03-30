create table if not exists welcome_drip_clients (
  id uuid primary key default gen_random_uuid(),
  business_name text not null,
  contact_name text,
  email text not null unique,
  industry text,
  drip_count int default 0,
  stripe_subscription_id text,
  active boolean default false,
  created_at timestamptz default now()
);

alter table welcome_drip_clients enable row level security;

create policy "service_role_all" on welcome_drip_clients
  for all using (true) with check (true);

create table if not exists welcome_drip_contacts (
  id uuid primary key default gen_random_uuid(),
  client_email text not null,
  contact_email text not null,
  contact_name text,
  step int default 0,
  next_send_at timestamptz,
  completed boolean default false,
  created_at timestamptz default now(),
  unique(client_email, contact_email)
);

alter table welcome_drip_contacts enable row level security;

create policy "service_role_all" on welcome_drip_contacts
  for all using (true) with check (true);
