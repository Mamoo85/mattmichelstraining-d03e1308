create table if not exists speed_lead_clients (
  id uuid primary key default gen_random_uuid(),
  business_name text not null,
  contact_name text,
  email text not null unique,
  phone text,
  twilio_number text,
  webhook_url text,
  lead_count int default 0,
  stripe_subscription_id text,
  active boolean default false,
  created_at timestamptz default now()
);

alter table speed_lead_clients enable row level security;

create policy "service_role_all" on speed_lead_clients
  for all using (true) with check (true);
