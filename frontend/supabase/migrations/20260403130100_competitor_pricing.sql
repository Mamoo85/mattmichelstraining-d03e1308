-- ── COMPETITOR PRICING INTELLIGENCE ─────────────────────────────────────────
-- competitor_pricing_clients: one row per paying subscriber
create table if not exists competitor_pricing_clients (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid references auth.users(id) on delete set null,
  customer_email         text not null,
  customer_name          text,
  company_name           text,
  industry               text,
  own_pricing_notes      text,
  stripe_subscription_id text,
  subscription_status    text not null default 'active',
  last_report_sent_at    timestamptz,
  created_at             timestamptz not null default now()
);

-- competitor_pricing_urls: URLs being monitored for each client
create table if not exists competitor_pricing_urls (
  id                  uuid primary key default gen_random_uuid(),
  client_id           uuid not null references competitor_pricing_clients(id) on delete cascade,
  competitor_name     text not null,
  url                 text not null,
  last_content_hash   text,
  last_scraped_at     timestamptz,
  created_at          timestamptz not null default now()
);

-- competitor_pricing_changes: detected changes per URL per client
create table if not exists competitor_pricing_changes (
  id                  uuid primary key default gen_random_uuid(),
  client_id           uuid not null references competitor_pricing_clients(id) on delete cascade,
  url_id              uuid references competitor_pricing_urls(id) on delete set null,
  competitor_name     text,
  change_summary      text,
  old_snippet         text,
  new_snippet         text,
  ai_recommendation   text,
  detected_at         timestamptz not null default now(),
  included_in_report  boolean not null default false
);

-- ── RLS ───────────────────────────────────────────────────────────────────────
alter table competitor_pricing_clients  enable row level security;
alter table competitor_pricing_urls     enable row level security;
alter table competitor_pricing_changes  enable row level security;

-- competitor_pricing_clients: users see only their own rows
create policy "competitor_pricing_clients_owner_select"
  on competitor_pricing_clients for select
  using (user_id = auth.uid());

create policy "competitor_pricing_clients_owner_insert"
  on competitor_pricing_clients for insert
  with check (user_id = auth.uid());

create policy "competitor_pricing_clients_owner_update"
  on competitor_pricing_clients for update
  using (user_id = auth.uid());

create policy "competitor_pricing_clients_owner_delete"
  on competitor_pricing_clients for delete
  using (user_id = auth.uid());

create policy "competitor_pricing_clients_service_all"
  on competitor_pricing_clients for all
  using (auth.role() = 'service_role');

-- competitor_pricing_urls: users see URLs for their own clients
create policy "competitor_pricing_urls_owner_select"
  on competitor_pricing_urls for select
  using (
    client_id in (
      select id from competitor_pricing_clients where user_id = auth.uid()
    )
  );

create policy "competitor_pricing_urls_owner_insert"
  on competitor_pricing_urls for insert
  with check (
    client_id in (
      select id from competitor_pricing_clients where user_id = auth.uid()
    )
  );

create policy "competitor_pricing_urls_owner_update"
  on competitor_pricing_urls for update
  using (
    client_id in (
      select id from competitor_pricing_clients where user_id = auth.uid()
    )
  );

create policy "competitor_pricing_urls_owner_delete"
  on competitor_pricing_urls for delete
  using (
    client_id in (
      select id from competitor_pricing_clients where user_id = auth.uid()
    )
  );

create policy "competitor_pricing_urls_service_all"
  on competitor_pricing_urls for all
  using (auth.role() = 'service_role');

-- competitor_pricing_changes: users see changes for their own clients
create policy "competitor_pricing_changes_owner_select"
  on competitor_pricing_changes for select
  using (
    client_id in (
      select id from competitor_pricing_clients where user_id = auth.uid()
    )
  );

create policy "competitor_pricing_changes_owner_insert"
  on competitor_pricing_changes for insert
  with check (
    client_id in (
      select id from competitor_pricing_clients where user_id = auth.uid()
    )
  );

create policy "competitor_pricing_changes_owner_update"
  on competitor_pricing_changes for update
  using (
    client_id in (
      select id from competitor_pricing_clients where user_id = auth.uid()
    )
  );

create policy "competitor_pricing_changes_owner_delete"
  on competitor_pricing_changes for delete
  using (
    client_id in (
      select id from competitor_pricing_clients where user_id = auth.uid()
    )
  );

create policy "competitor_pricing_changes_service_all"
  on competitor_pricing_changes for all
  using (auth.role() = 'service_role');

-- indexes for common lookups
create index if not exists competitor_pricing_clients_user_id_idx       on competitor_pricing_clients(user_id);
create index if not exists competitor_pricing_clients_status_idx        on competitor_pricing_clients(subscription_status);
create index if not exists competitor_pricing_urls_client_id_idx        on competitor_pricing_urls(client_id);
create index if not exists competitor_pricing_changes_client_id_idx     on competitor_pricing_changes(client_id);
create index if not exists competitor_pricing_changes_reported_idx      on competitor_pricing_changes(included_in_report);
