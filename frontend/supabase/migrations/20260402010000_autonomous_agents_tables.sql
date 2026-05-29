-- ═══════════════════════════════════════════════════════════════════════════
-- AUTONOMOUS AGENT TABLES
-- Matrix agents (Neo, Oracle, Mouse, Morpheus) + Star Wars agents (Luke,
-- Leia, Han, R2-D2, Yoda) — each agent gets a tracking table so their work
-- is logged, auditable, and retry-safe.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── PROSPECT BUSINESSES (Neo's lead database) ────────────────────────────
create table if not exists prospect_businesses (
  id              uuid primary key default gen_random_uuid(),
  business_name   text not null,
  address         text,
  city            text,
  state           text default 'MI',
  phone           text,
  website         text,
  industry        text,
  google_place_id text unique,
  review_count    integer default 0,
  rating          numeric(2,1),
  tier            text default 'B',        -- A | B | C
  has_website     boolean default true,
  outreach_status text default 'new',      -- new | contacted | replied | closed_won | closed_lost | do_not_contact
  notes           text,
  source          text default 'scraper',
  created_at      timestamptz not null default now()
);

alter table prospect_businesses enable row level security;
create policy "service_role_all_prospect_businesses"
  on prospect_businesses for all to service_role using (true) with check (true);
create index if not exists prospect_businesses_tier_idx on prospect_businesses(tier);
create index if not exists prospect_businesses_status_idx on prospect_businesses(outreach_status);
create index if not exists prospect_businesses_industry_idx on prospect_businesses(industry);
create index if not exists prospect_businesses_created_idx on prospect_businesses(created_at desc);

-- ── PROSPECT OUTREACH (Neo tracks every email sent) ──────────────────────
create table if not exists prospect_outreach (
  id            uuid primary key default gen_random_uuid(),
  prospect_id   uuid references prospect_businesses(id) on delete set null,
  email         text not null,
  business_name text,
  industry      text,
  outreach_type text not null,             -- initial | follow_up_1 | follow_up_2
  subject       text,
  status        text not null default 'sent', -- sent | opened | replied | bounced | unsubscribed
  sent_at       timestamptz not null default now(),
  replied_at    timestamptz,
  created_at    timestamptz not null default now()
);

alter table prospect_outreach enable row level security;
create policy "service_role_all_prospect_outreach"
  on prospect_outreach for all to service_role using (true) with check (true);
create index if not exists prospect_outreach_email_idx on prospect_outreach(email);
create index if not exists prospect_outreach_sent_at_idx on prospect_outreach(sent_at desc);
create index if not exists prospect_outreach_type_idx on prospect_outreach(outreach_type);

-- ── UPSELL SEQUENCES (Han tracks every upsell attempt) ───────────────────
create table if not exists upsell_sequences (
  id             uuid primary key default gen_random_uuid(),
  email          text not null,
  product_bought text not null,            -- website_audit | gbp_post_pack | competitor_report | etc
  upsell_product text not null,            -- what we're pitching them
  step           integer not null default 1,
  status         text not null default 'queued', -- queued | sent | converted | skipped | unsubscribed
  sent_at        timestamptz,
  converted_at   timestamptz,
  order_ref_id   uuid,
  created_at     timestamptz not null default now()
);

alter table upsell_sequences enable row level security;
create policy "service_role_all_upsell_sequences"
  on upsell_sequences for all to service_role using (true) with check (true);
create index if not exists upsell_sequences_email_idx on upsell_sequences(email);
create index if not exists upsell_sequences_status_idx on upsell_sequences(status);
create index if not exists upsell_sequences_created_idx on upsell_sequences(created_at desc);

-- ── CART ABANDONMENTS (Luke tracks every near-miss) ──────────────────────
create table if not exists cart_abandonments (
  id                  uuid primary key default gen_random_uuid(),
  email               text,
  product_type        text,
  stripe_session_id   text unique,
  cart_value          numeric(10,2),
  metadata            jsonb default '{}',
  recovery_1_sent_at  timestamptz,
  recovery_2_sent_at  timestamptz,
  recovered           boolean default false,
  recovered_at        timestamptz,
  created_at          timestamptz not null default now()
);

alter table cart_abandonments enable row level security;
create policy "service_role_all_cart_abandonments"
  on cart_abandonments for all to service_role using (true) with check (true);
create index if not exists cart_abandonments_email_idx on cart_abandonments(email);
create index if not exists cart_abandonments_created_idx on cart_abandonments(created_at desc);
create index if not exists cart_abandonments_recovered_idx on cart_abandonments(recovered);

-- ── ONBOARDING SEQUENCES (Leia tracks every welcome journey) ─────────────
create table if not exists onboarding_sequences (
  id               uuid primary key default gen_random_uuid(),
  email            text not null,
  name             text,
  product          text not null,           -- gbp_saas | social_media_ai | field_rep_tools | contractor_leads | etc
  current_step     integer not null default 0,
  steps_completed  integer[] default '{}',
  status           text not null default 'active', -- active | completed | paused | unsubscribed
  last_sent_at     timestamptz,
  created_at       timestamptz not null default now()
);

alter table onboarding_sequences enable row level security;
create policy "service_role_all_onboarding_sequences"
  on onboarding_sequences for all to service_role using (true) with check (true);
create index if not exists onboarding_sequences_email_idx on onboarding_sequences(email);
create index if not exists onboarding_sequences_status_idx on onboarding_sequences(status);
create index if not exists onboarding_sequences_step_idx on onboarding_sequences(current_step);

-- ── SYSTEM HEALTH LOG (R2's diagnostic records) ───────────────────────────
create table if not exists system_health_log (
  id          uuid primary key default gen_random_uuid(),
  check_type  text not null,               -- cron_check | delivery_check | edge_function_check | revenue_check
  status      text not null,               -- healthy | warning | critical
  details     jsonb default '{}',
  alerted     boolean default false,
  created_at  timestamptz not null default now()
);

alter table system_health_log enable row level security;
create policy "service_role_all_system_health_log"
  on system_health_log for all to service_role using (true) with check (true);
create index if not exists system_health_log_status_idx on system_health_log(status);
create index if not exists system_health_log_created_idx on system_health_log(created_at desc);

-- ── CRON SCHEDULES ────────────────────────────────────────────────────────
-- Requires pg_cron extension (enabled in Supabase by default)

select cron.schedule(
  'oracle-monitor-daily',
  '0 10 * * *',   -- 10:00 UTC = 6am ET daily
  $$select net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/oracle-monitor',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{}'::jsonb
  )$$
) on conflict (jobname) do nothing;

select cron.schedule(
  'neo-outreach-daily',
  '0 18 * * *',   -- 18:00 UTC = 2pm ET daily (after prospects scraped at 11am)
  $$select net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/neo-outreach',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{}'::jsonb
  )$$
) on conflict (jobname) do nothing;

select cron.schedule(
  'han-upsell-hourly',
  '0 */4 * * *',  -- every 4 hours
  $$select net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/han-upsell',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{}'::jsonb
  )$$
) on conflict (jobname) do nothing;

select cron.schedule(
  'luke-recovery-hourly',
  '30 * * * *',   -- every hour at :30 past
  $$select net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/luke-recovery',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{}'::jsonb
  )$$
) on conflict (jobname) do nothing;

select cron.schedule(
  'leia-onboard-daily',
  '0 13 * * *',   -- 13:00 UTC = 9am ET daily
  $$select net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/leia-onboard',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{}'::jsonb
  )$$
) on conflict (jobname) do nothing;

select cron.schedule(
  'r2-watchdog-bihourly',
  '0 */2 * * *',  -- every 2 hours
  $$select net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/r2-watchdog',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{}'::jsonb
  )$$
) on conflict (jobname) do nothing;

select cron.schedule(
  'yoda-retain-daily',
  '0 14 * * *',   -- 14:00 UTC = 10am ET daily
  $$select net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/yoda-retain',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{}'::jsonb
  )$$
) on conflict (jobname) do nothing;

select cron.schedule(
  'morpheus-demand-weekly',
  '0 12 * * 0',   -- Sunday 12:00 UTC = 8am ET
  $$select net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/morpheus-demand',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{}'::jsonb
  )$$
) on conflict (jobname) do nothing;
