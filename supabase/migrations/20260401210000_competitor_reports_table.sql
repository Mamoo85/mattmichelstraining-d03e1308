-- AI Competitor Analysis Reports
create table if not exists competitor_reports (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  business_name text,
  city text,
  industry text,
  status text not null default 'pending', -- pending | processing | delivered | failed
  report_text text,
  competitors_json jsonb,
  stripe_session_id text,
  created_at timestamptz not null default now()
);

alter table competitor_reports enable row level security;

create policy "service_role_all_competitor_reports"
  on competitor_reports for all
  to service_role using (true) with check (true);

create index if not exists competitor_reports_email_idx on competitor_reports(email);
create index if not exists competitor_reports_status_idx on competitor_reports(status);
