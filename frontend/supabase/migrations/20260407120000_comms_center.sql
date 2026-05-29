-- Communications Command Center: leads + messages tables
-- leads: one row per inbound contact (phone number + routing)
-- messages: full conversation thread per lead

create table if not exists leads (
  id             uuid primary key default gen_random_uuid(),
  phone_number   text not null,
  business_route text not null default 'Uncategorized'
                 check (business_route in ('Training', 'Web_Dev', 'Uncategorized')),
  status         text not null default 'New'
                 check (status in ('New', 'Handled')),
  created_at     timestamptz not null default now()
);

alter table leads enable row level security;

-- service_role bypass (n8n webhook inserts rows directly via service key)
create policy "service_role_all_leads" on leads
  for all using (auth.role() = 'service_role');

-- authenticated users (Matt's dashboard) can read all leads
create policy "authenticated_select_leads" on leads
  for select to authenticated using (true);

-- authenticated users can update leads (mark as Handled)
create policy "authenticated_update_leads" on leads
  for update to authenticated using (true) with check (true);

-- messages: one row per SMS in the conversation thread
create table if not exists messages (
  id         uuid primary key default gen_random_uuid(),
  lead_id    uuid not null references leads(id) on delete cascade,
  direction  text not null check (direction in ('inbound', 'outbound')),
  body       text not null,
  created_at timestamptz not null default now()
);

alter table messages enable row level security;

-- service_role bypass (n8n inserts inbound messages; outbound saved by edge fn or n8n)
create policy "service_role_all_messages" on messages
  for all using (auth.role() = 'service_role');

-- authenticated users can read messages (to render chat threads)
create policy "authenticated_select_messages" on messages
  for select to authenticated using (true);

-- authenticated users can insert outbound messages (optimistic UI confirm)
create policy "authenticated_insert_messages" on messages
  for insert to authenticated with check (true);
