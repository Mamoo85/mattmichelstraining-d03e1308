-- ── AI REGULATORY CHANGE MONITOR ────────────────────────────────────────────
-- regulatory_monitor_clients: one row per paying subscriber
create table if not exists regulatory_monitor_clients (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid references auth.users(id) on delete set null,
  customer_email         text not null,
  customer_name          text,
  company_name           text,
  industry               text not null,
  sub_industries         text,
  state_focus            text,
  stripe_subscription_id text,
  subscription_status    text not null default 'active',
  last_sent_at           timestamptz,
  created_at             timestamptz not null default now()
);

-- regulatory_monitor_items: one row per regulatory item per client
create table if not exists regulatory_monitor_items (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid not null references regulatory_monitor_clients(id) on delete cascade,
  source_url      text,
  title           text,
  agency          text,
  published_date  date,
  summary         text,
  impact_level    text not null default 'medium',
  sent_to_client  boolean not null default false,
  created_at      timestamptz not null default now(),
  unique(client_id, source_url)
);

-- ── RLS ───────────────────────────────────────────────────────────────────────
alter table regulatory_monitor_clients enable row level security;
alter table regulatory_monitor_items   enable row level security;

-- regulatory_monitor_clients: users see only their own rows
create policy "regulatory_monitor_clients_owner_select"
  on regulatory_monitor_clients for select
  using (user_id = auth.uid());

create policy "regulatory_monitor_clients_owner_insert"
  on regulatory_monitor_clients for insert
  with check (user_id = auth.uid());

create policy "regulatory_monitor_clients_owner_update"
  on regulatory_monitor_clients for update
  using (user_id = auth.uid());

create policy "regulatory_monitor_clients_owner_delete"
  on regulatory_monitor_clients for delete
  using (user_id = auth.uid());

-- service role bypass
create policy "regulatory_monitor_clients_service_all"
  on regulatory_monitor_clients for all
  using (auth.role() = 'service_role');

-- regulatory_monitor_items: users see items for their own clients
create policy "regulatory_monitor_items_owner_select"
  on regulatory_monitor_items for select
  using (
    client_id in (
      select id from regulatory_monitor_clients where user_id = auth.uid()
    )
  );

create policy "regulatory_monitor_items_owner_insert"
  on regulatory_monitor_items for insert
  with check (
    client_id in (
      select id from regulatory_monitor_clients where user_id = auth.uid()
    )
  );

create policy "regulatory_monitor_items_owner_update"
  on regulatory_monitor_items for update
  using (
    client_id in (
      select id from regulatory_monitor_clients where user_id = auth.uid()
    )
  );

create policy "regulatory_monitor_items_owner_delete"
  on regulatory_monitor_items for delete
  using (
    client_id in (
      select id from regulatory_monitor_clients where user_id = auth.uid()
    )
  );

create policy "regulatory_monitor_items_service_all"
  on regulatory_monitor_items for all
  using (auth.role() = 'service_role');

-- indexes for common lookups
create index if not exists reg_monitor_clients_user_id_idx       on regulatory_monitor_clients(user_id);
create index if not exists reg_monitor_clients_subscription_idx  on regulatory_monitor_clients(subscription_status);
create index if not exists reg_monitor_items_client_id_idx       on regulatory_monitor_items(client_id);
create index if not exists reg_monitor_items_sent_idx            on regulatory_monitor_items(sent_to_client);
create index if not exists reg_monitor_items_impact_idx          on regulatory_monitor_items(impact_level);
