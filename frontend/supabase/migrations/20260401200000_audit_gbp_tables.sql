-- AI Website Audit orders
create table if not exists audit_orders (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  business_name text,
  business_url text,
  status text not null default 'pending', -- pending | processing | delivered | failed
  report_text text,
  stripe_session_id text,
  created_at timestamptz not null default now()
);

alter table audit_orders enable row level security;

create policy "service_role_all_audit_orders"
  on audit_orders for all
  to service_role using (true) with check (true);

create index if not exists audit_orders_email_idx on audit_orders(email);
create index if not exists audit_orders_status_idx on audit_orders(status);

-- GBP Post Packs
create table if not exists gbp_post_packs (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  business_name text,
  business_info jsonb,
  posts_json jsonb,
  status text not null default 'pending', -- pending | processing | delivered | failed
  stripe_session_id text,
  created_at timestamptz not null default now()
);

alter table gbp_post_packs enable row level security;

create policy "service_role_all_gbp_post_packs"
  on gbp_post_packs for all
  to service_role using (true) with check (true);

create index if not exists gbp_post_packs_email_idx on gbp_post_packs(email);
create index if not exists gbp_post_packs_status_idx on gbp_post_packs(status);
