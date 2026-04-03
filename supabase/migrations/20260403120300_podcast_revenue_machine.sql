-- ── PODCAST REVENUE MACHINE ─────────────────────────────────────────────────
-- podcast_clients: one row per paying subscriber
create table if not exists podcast_clients (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid references auth.users(id) on delete set null,
  customer_email         text not null,
  customer_name          text,
  podcast_name           text,
  rss_feed_url           text not null,
  podcast_niche          text,
  target_audience        text,
  tone                   text not null default 'professional',
  stripe_subscription_id text,
  subscription_status    text not null default 'active',
  last_checked_at        timestamptz,
  last_episode_guid      text,
  created_at             timestamptz not null default now()
);

-- podcast_episodes: one row per episode per client
create table if not exists podcast_episodes (
  id                   uuid primary key default gen_random_uuid(),
  client_id            uuid not null references podcast_clients(id) on delete cascade,
  episode_guid         text not null,
  episode_title        text,
  episode_description  text,
  episode_url          text,
  published_at         timestamptz,
  blog_post            text,
  linkedin_post        text,
  email_newsletter     text,
  youtube_description  text,
  twitter_thread       text,
  content_sent         boolean not null default false,
  created_at           timestamptz not null default now(),
  unique(client_id, episode_guid)
);

-- ── RLS ───────────────────────────────────────────────────────────────────────
alter table podcast_clients  enable row level security;
alter table podcast_episodes enable row level security;

-- podcast_clients: users see only their own rows
create policy "podcast_clients_owner_select"
  on podcast_clients for select
  using (user_id = auth.uid());

create policy "podcast_clients_owner_insert"
  on podcast_clients for insert
  with check (user_id = auth.uid());

create policy "podcast_clients_owner_update"
  on podcast_clients for update
  using (user_id = auth.uid());

create policy "podcast_clients_owner_delete"
  on podcast_clients for delete
  using (user_id = auth.uid());

-- service role bypass
create policy "podcast_clients_service_all"
  on podcast_clients for all
  using (auth.role() = 'service_role');

-- podcast_episodes: users see episodes for their own clients
create policy "podcast_episodes_owner_select"
  on podcast_episodes for select
  using (
    client_id in (
      select id from podcast_clients where user_id = auth.uid()
    )
  );

create policy "podcast_episodes_owner_insert"
  on podcast_episodes for insert
  with check (
    client_id in (
      select id from podcast_clients where user_id = auth.uid()
    )
  );

create policy "podcast_episodes_owner_update"
  on podcast_episodes for update
  using (
    client_id in (
      select id from podcast_clients where user_id = auth.uid()
    )
  );

create policy "podcast_episodes_owner_delete"
  on podcast_episodes for delete
  using (
    client_id in (
      select id from podcast_clients where user_id = auth.uid()
    )
  );

create policy "podcast_episodes_service_all"
  on podcast_episodes for all
  using (auth.role() = 'service_role');

-- indexes for common lookups
create index if not exists podcast_clients_user_id_idx         on podcast_clients(user_id);
create index if not exists podcast_clients_subscription_idx    on podcast_clients(subscription_status);
create index if not exists podcast_episodes_client_id_idx      on podcast_episodes(client_id);
create index if not exists podcast_episodes_content_sent_idx   on podcast_episodes(content_sent);
