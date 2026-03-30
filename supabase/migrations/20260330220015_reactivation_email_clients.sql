create table if not exists reactivation_email_clients (
  id uuid primary key default gen_random_uuid(),
  business_name text not null,
  contact_name text,
  email text not null unique,
  industry text,
  email_count int default 0,
  stripe_subscription_id text,
  active boolean default false,
  created_at timestamptz default now()
);

alter table reactivation_email_clients enable row level security;

create policy "service_role_all" on reactivation_email_clients
  for all using (true) with check (true);

create table if not exists reactivation_contacts (
  id uuid primary key default gen_random_uuid(),
  client_email text not null,
  contact_email text not null,
  contact_name text,
  last_purchase_date timestamptz,
  created_at timestamptz default now(),
  unique(client_email, contact_email)
);

alter table reactivation_contacts enable row level security;

create policy "service_role_all" on reactivation_contacts
  for all using (true) with check (true);
