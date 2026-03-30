create table if not exists competitor_watch_clients (
  id uuid primary key default gen_random_uuid(),
  business_name text not null,
  contact_name text,
  email text not null unique,
  industry text,
  city text,
  competitor_urls text[],
  report_count int default 0,
  last_report_at timestamptz,
  stripe_subscription_id text,
  active boolean default false,
  created_at timestamptz default now()
);

alter table competitor_watch_clients enable row level security;

create policy "service_role_all" on competitor_watch_clients
  for all using (true) with check (true);
