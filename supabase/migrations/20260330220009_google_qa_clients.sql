create table if not exists google_qa_clients (
  id uuid primary key default gen_random_uuid(),
  business_name text not null,
  contact_name text,
  email text not null unique,
  gmb_place_id text,
  answer_count int default 0,
  stripe_subscription_id text,
  active boolean default false,
  created_at timestamptz default now()
);

alter table google_qa_clients enable row level security;

create policy "service_role_all" on google_qa_clients
  for all using (true) with check (true);
