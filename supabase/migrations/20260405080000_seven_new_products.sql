-- ═══════════════════════════════════════════════════════════════════════════
-- SEVEN NEW PRODUCTS + TECH SUPPORT
-- Storm Damage Leads, Recall Alerts, Permit Watch, Website Speed Audits,
-- AI Bedtime Stories, Neighborhood Crime Digest, Business License Monitor,
-- Local Tech Support
-- ═══════════════════════════════════════════════════════════════════════════

-- ── STORM DAMAGE LEAD BLASTER ────────────────────────────────────────────
create table if not exists storm_lead_clients (
  id                    uuid primary key default gen_random_uuid(),
  business_name         text not null,
  email                 text not null,
  phone                 text,
  zip_codes             text[] default '{}',
  trade                 text,
  active                boolean default true,
  stripe_subscription_id text,
  created_at            timestamptz not null default now()
);
alter table storm_lead_clients enable row level security;
create policy "service_role_all_storm_lead_clients"
  on storm_lead_clients for all to service_role using (true) with check (true);
create index if not exists storm_lead_clients_email_idx on storm_lead_clients(email);
create index if not exists storm_lead_clients_active_idx on storm_lead_clients(active);

-- Track sent alerts to avoid duplicates
create table if not exists storm_alerts_sent (
  id         uuid primary key default gen_random_uuid(),
  alert_id   text not null unique,
  event_type text,
  zones      text[],
  sent_at    timestamptz not null default now()
);
alter table storm_alerts_sent enable row level security;
create policy "service_role_all_storm_alerts_sent"
  on storm_alerts_sent for all to service_role using (true) with check (true);

-- ── RECALL ALERT SERVICE ─────────────────────────────────────────────────
create table if not exists recall_alert_clients (
  id                    uuid primary key default gen_random_uuid(),
  business_name         text not null,
  email                 text not null,
  phone                 text,
  industry              text,
  product_categories    text[] default '{}',
  active                boolean default true,
  stripe_subscription_id text,
  created_at            timestamptz not null default now()
);
alter table recall_alert_clients enable row level security;
create policy "service_role_all_recall_alert_clients"
  on recall_alert_clients for all to service_role using (true) with check (true);
create index if not exists recall_alert_clients_email_idx on recall_alert_clients(email);
create index if not exists recall_alert_clients_active_idx on recall_alert_clients(active);

-- ── PERMIT WATCH ─────────────────────────────────────────────────────────
create table if not exists permit_watch_clients (
  id                    uuid primary key default gen_random_uuid(),
  business_name         text not null,
  email                 text not null,
  phone                 text,
  city                  text default 'Grosse Pointe',
  state                 text default 'MI',
  trades                text[] default '{}',
  active                boolean default true,
  stripe_subscription_id text,
  last_report_at        timestamptz,
  created_at            timestamptz not null default now()
);
alter table permit_watch_clients enable row level security;
create policy "service_role_all_permit_watch_clients"
  on permit_watch_clients for all to service_role using (true) with check (true);
create index if not exists permit_watch_clients_email_idx on permit_watch_clients(email);
create index if not exists permit_watch_clients_active_idx on permit_watch_clients(active);

-- ── WEBSITE SPEED AUDIT ──────────────────────────────────────────────────
create table if not exists speed_audit_clients (
  id                    uuid primary key default gen_random_uuid(),
  business_name         text not null,
  email                 text not null,
  website_url           text not null,
  active                boolean default true,
  stripe_subscription_id text,
  last_report_at        timestamptz,
  created_at            timestamptz not null default now()
);
alter table speed_audit_clients enable row level security;
create policy "service_role_all_speed_audit_clients"
  on speed_audit_clients for all to service_role using (true) with check (true);
create index if not exists speed_audit_clients_email_idx on speed_audit_clients(email);
create index if not exists speed_audit_clients_active_idx on speed_audit_clients(active);

-- ── AI BEDTIME STORIES ───────────────────────────────────────────────────
create table if not exists bedtime_story_clients (
  id                    uuid primary key default gen_random_uuid(),
  parent_email          text not null,
  child_name            text not null,
  child_age             integer default 5,
  interests             text[] default '{}',
  active                boolean default true,
  stripe_subscription_id text,
  created_at            timestamptz not null default now()
);
alter table bedtime_story_clients enable row level security;
create policy "service_role_all_bedtime_story_clients"
  on bedtime_story_clients for all to service_role using (true) with check (true);
create index if not exists bedtime_story_clients_email_idx on bedtime_story_clients(parent_email);
create index if not exists bedtime_story_clients_active_idx on bedtime_story_clients(active);

-- ── NEIGHBORHOOD CRIME DIGEST ────────────────────────────────────────────
create table if not exists crime_digest_clients (
  id                    uuid primary key default gen_random_uuid(),
  business_name         text,
  email                 text not null,
  phone                 text,
  zip_code              text not null,
  city                  text,
  state                 text default 'MI',
  client_type           text default 'property_manager',
  active                boolean default true,
  stripe_subscription_id text,
  created_at            timestamptz not null default now()
);
alter table crime_digest_clients enable row level security;
create policy "service_role_all_crime_digest_clients"
  on crime_digest_clients for all to service_role using (true) with check (true);
create index if not exists crime_digest_clients_email_idx on crime_digest_clients(email);
create index if not exists crime_digest_clients_active_idx on crime_digest_clients(active);

-- ── BUSINESS LICENSE EXPIRY MONITOR ──────────────────────────────────────
create table if not exists license_monitor_clients (
  id                    uuid primary key default gen_random_uuid(),
  business_name         text not null,
  email                 text not null,
  phone                 text,
  state                 text default 'MI',
  license_types         text[] default '{}',
  active                boolean default true,
  stripe_subscription_id text,
  created_at            timestamptz not null default now()
);
alter table license_monitor_clients enable row level security;
create policy "service_role_all_license_monitor_clients"
  on license_monitor_clients for all to service_role using (true) with check (true);
create index if not exists license_monitor_clients_email_idx on license_monitor_clients(email);
create index if not exists license_monitor_clients_active_idx on license_monitor_clients(active);

-- License tracking items (each license a client wants monitored)
create table if not exists license_monitor_items (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid references license_monitor_clients(id) on delete cascade,
  license_name    text not null,
  license_number  text,
  issuing_body    text,
  expiry_date     date not null,
  reminders_sent  integer default 0,
  created_at      timestamptz not null default now()
);
alter table license_monitor_items enable row level security;
create policy "service_role_all_license_monitor_items"
  on license_monitor_items for all to service_role using (true) with check (true);
create index if not exists license_monitor_items_client_idx on license_monitor_items(client_id);
create index if not exists license_monitor_items_expiry_idx on license_monitor_items(expiry_date);

-- ── TECH SUPPORT TICKETS ─────────────────────────────────────────────────
create table if not exists tech_support_tickets (
  id                uuid primary key default gen_random_uuid(),
  name              text,
  email             text not null,
  phone             text,
  issue_description text,
  tier              text default 'one-time',
  status            text default 'new',
  stripe_session_id text,
  created_at        timestamptz not null default now()
);
alter table tech_support_tickets enable row level security;
create policy "service_role_all_tech_support_tickets"
  on tech_support_tickets for all to service_role using (true) with check (true);
create index if not exists tech_support_tickets_email_idx on tech_support_tickets(email);
create index if not exists tech_support_tickets_status_idx on tech_support_tickets(status);
