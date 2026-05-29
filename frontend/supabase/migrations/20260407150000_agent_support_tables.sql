-- Agent Support Tables
-- Supports: Comply (violations log), Cashier (dunning), Shield (win-back),
--           Nova (onboarding sequences), Agent heartbeats, Trigger log

-- ── Comply: regulatory violation log ─────────────────────────────────────────
create table if not exists comply_violations (
  id            uuid primary key default gen_random_uuid(),
  check_type    text not null check (check_type in ('tcpa', 'canspam', 'stripe', 'gdpr')),
  severity      text not null check (severity in ('critical', 'warning', 'info')),
  description   text not null,
  affected_table text,
  affected_id   uuid,
  resolved      boolean not null default false,
  created_at    timestamptz not null default now()
);
alter table comply_violations enable row level security;
create policy "service_role_all_comply" on comply_violations
  for all using (auth.role() = 'service_role');
create policy "authenticated_select_comply" on comply_violations
  for select to authenticated using (true);

-- ── Cashier: dunning email log ────────────────────────────────────────────────
create table if not exists dunning_sends (
  id                  uuid primary key default gen_random_uuid(),
  customer_email      text not null,
  stripe_customer_id  text,
  day_number          integer not null check (day_number in (1, 3, 7)),
  amount_cents        integer,
  sent_at             timestamptz not null default now()
);
alter table dunning_sends enable row level security;
create policy "service_role_all_dunning" on dunning_sends
  for all using (auth.role() = 'service_role');
create policy "authenticated_select_dunning" on dunning_sends
  for select to authenticated using (true);

-- ── Shield: win-back sequences ────────────────────────────────────────────────
create table if not exists winback_sequences (
  id                      uuid primary key default gen_random_uuid(),
  customer_email          text not null,
  product                 text not null,
  stripe_subscription_id  text,
  step                    integer not null default 1,
  status                  text not null default 'active'
                          check (status in ('active', 'won', 'exhausted')),
  last_sent_at            timestamptz,
  created_at              timestamptz not null default now()
);
alter table winback_sequences enable row level security;
create policy "service_role_all_winback" on winback_sequences
  for all using (auth.role() = 'service_role');
create policy "authenticated_select_winback" on winback_sequences
  for select to authenticated using (true);

-- ── Nova: first-7-day onboarding send log ─────────────────────────────────────
create table if not exists nova_sends (
  id             uuid primary key default gen_random_uuid(),
  client_email   text not null,
  product        text not null,
  day_number     integer not null check (day_number in (3, 7)),
  sent_at        timestamptz not null default now()
);
alter table nova_sends enable row level security;
create policy "service_role_all_nova" on nova_sends
  for all using (auth.role() = 'service_role');
create policy "authenticated_select_nova" on nova_sends
  for select to authenticated using (true);

-- ── Agent heartbeats (for Command Deck health indicators) ─────────────────────
create table if not exists agent_heartbeats (
  agent_name    text primary key,
  last_run_at   timestamptz not null default now(),
  last_status   text not null default 'ok' check (last_status in ('ok', 'warn', 'error')),
  detail        text
);
alter table agent_heartbeats enable row level security;
create policy "service_role_all_heartbeats" on agent_heartbeats
  for all using (auth.role() = 'service_role');
create policy "authenticated_select_heartbeats" on agent_heartbeats
  for select to authenticated using (true);

-- Seed the 13 active agents so the UI shows them immediately
insert into agent_heartbeats (agent_name, last_run_at, last_status) values
  ('oz', now(), 'ok'),
  ('tom', now(), 'ok'),
  ('ops', now(), 'ok'),
  ('oracle', now(), 'ok'),
  ('shield', now(), 'ok'),
  ('cashier', now(), 'ok'),
  ('scout', now(), 'ok'),
  ('hype', now(), 'ok'),
  ('drill', now(), 'ok'),
  ('pulse', now(), 'ok'),
  ('ref', now(), 'ok'),
  ('selma', now(), 'ok'),
  ('scarlett', now(), 'ok')
on conflict (agent_name) do nothing;

-- ── Command Deck trigger log ──────────────────────────────────────────────────
create table if not exists trigger_log (
  id              uuid primary key default gen_random_uuid(),
  function_name   text not null,
  label           text not null,
  result          text not null default 'ok' check (result in ('ok', 'error')),
  error_message   text,
  triggered_at    timestamptz not null default now()
);
alter table trigger_log enable row level security;
create policy "service_role_all_trigger_log" on trigger_log
  for all using (auth.role() = 'service_role');
create policy "authenticated_all_trigger_log" on trigger_log
  for all to authenticated using (true) with check (true);

-- ── Cron jobs for new edge functions ─────────────────────────────────────────
select cron.schedule('comply-monitor-daily',   '0 11 * * *', $$select net.http_post(url:=current_setting('app.supabase_url') || '/functions/v1/comply-monitor',   headers:='{"Authorization": "Bearer ' || current_setting('app.service_role_key') || '"}'::jsonb, body:='{}'::jsonb) as request_id$$);
select cron.schedule('cashier-dunning-daily',  '0 12 * * *', $$select net.http_post(url:=current_setting('app.supabase_url') || '/functions/v1/cashier-dunning',  headers:='{"Authorization": "Bearer ' || current_setting('app.service_role_key') || '"}'::jsonb, body:='{}'::jsonb) as request_id$$);
select cron.schedule('shield-winback-daily',   '0 13 * * *', $$select net.http_post(url:=current_setting('app.supabase_url') || '/functions/v1/shield-winback',   headers:='{"Authorization": "Bearer ' || current_setting('app.service_role_key') || '"}'::jsonb, body:='{}'::jsonb) as request_id$$);
select cron.schedule('nova-onboarding-daily',  '0 14 * * *', $$select net.http_post(url:=current_setting('app.supabase_url') || '/functions/v1/nova-onboarding',  headers:='{"Authorization": "Bearer ' || current_setting('app.service_role_key') || '"}'::jsonb, body:='{}'::jsonb) as request_id$$);
