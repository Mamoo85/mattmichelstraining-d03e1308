create table if not exists satisfaction_survey_clients (
  id uuid primary key default gen_random_uuid(),
  business_name text not null,
  contact_name text,
  email text not null unique,
  phone text,
  twilio_number text,
  survey_count int default 0,
  avg_score numeric(3,1),
  stripe_subscription_id text,
  active boolean default false,
  created_at timestamptz default now()
);

alter table satisfaction_survey_clients enable row level security;

create policy "service_role_all" on satisfaction_survey_clients
  for all using (true) with check (true);
