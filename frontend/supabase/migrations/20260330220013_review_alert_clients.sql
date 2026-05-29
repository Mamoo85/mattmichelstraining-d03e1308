create table if not exists review_alert_clients (
  id uuid primary key default gen_random_uuid(),
  business_name text not null,
  contact_name text,
  email text not null unique,
  phone text,
  gmb_place_id text,
  alert_count int default 0,
  stripe_subscription_id text,
  active boolean default false,
  created_at timestamptz default now()
);

alter table review_alert_clients enable row level security;

create policy "service_role_all" on review_alert_clients
  for all using (true) with check (true);
