create table if not exists warranty_reminder_clients (
  id uuid primary key default gen_random_uuid(),
  business_name text not null,
  contact_name text,
  email text not null unique,
  phone text,
  twilio_number text,
  industry text,
  reminder_count int default 0,
  stripe_subscription_id text,
  active boolean default false,
  created_at timestamptz default now()
);

alter table warranty_reminder_clients enable row level security;

create policy "service_role_all" on warranty_reminder_clients
  for all using (true) with check (true);

create table if not exists warranty_contacts (
  id uuid primary key default gen_random_uuid(),
  client_email text not null,
  contact_phone text not null,
  contact_name text,
  warranty_expires_at timestamptz,
  product_name text,
  sent_at timestamptz,
  created_at timestamptz default now(),
  unique(client_email, contact_phone)
);

alter table warranty_contacts enable row level security;

create policy "service_role_all" on warranty_contacts
  for all using (true) with check (true);
