create table if not exists public.product_changelog (
  id uuid primary key default gen_random_uuid(),
  ship_date date not null default current_date,
  product text not null,
  title text not null,
  body text not null,
  tags text[] not null default '{}',
  is_public boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_product_changelog_ship_date on public.product_changelog (ship_date desc);
create index if not exists idx_product_changelog_public on public.product_changelog (is_public, ship_date desc) where is_public = true;

alter table public.product_changelog enable row level security;

drop policy if exists "Public can read public changelog" on public.product_changelog;
create policy "Public can read public changelog"
  on public.product_changelog for select
  using (is_public = true);

drop policy if exists "Service role full access changelog" on public.product_changelog;
create policy "Service role full access changelog"
  on public.product_changelog for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "Admins manage changelog" on public.product_changelog;
create policy "Admins manage changelog"
  on public.product_changelog for all
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));


create table if not exists public.client_price_locks (
  id uuid primary key default gen_random_uuid(),
  client_id uuid,
  client_email text not null,
  product text not null,
  locked_monthly_price numeric(10,2) not null,
  locked_since date not null default current_date,
  stripe_subscription_id text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_client_price_locks_email on public.client_price_locks (lower(client_email));
create index if not exists idx_client_price_locks_client on public.client_price_locks (client_id) where client_id is not null;
create unique index if not exists uq_client_price_locks_active on public.client_price_locks (lower(client_email), product) where active = true;

alter table public.client_price_locks enable row level security;

drop policy if exists "Service role full access price_locks" on public.client_price_locks;
create policy "Service role full access price_locks"
  on public.client_price_locks for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "Admins manage price_locks" on public.client_price_locks;
create policy "Admins manage price_locks"
  on public.client_price_locks for all
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists "Clients read own price_locks" on public.client_price_locks;
create policy "Clients read own price_locks"
  on public.client_price_locks for select
  using (client_id = auth.uid());

insert into public.product_changelog (ship_date, product, title, body, tags) values
  (current_date, 'Forever Pricing', 'Locked-price guarantee shipped', 'Every Managed Website client now has a lifetime price lock. Every future upgrade is included free, forever.', array['pricing','launch']),
  (current_date - 1, 'SiteRadar Pro', 'Cross-radar fusion alerts (beta)', 'When a visitor matches an active RFP signal, you get one SMS combining both. No competitor can do this.', array['siteradar','fusion']),
  (current_date - 2, 'Predictive Sales', 'Industry decision matrix', 'Recommended-product matching by industry rolled out — auto, healthcare, manufacturing tuned first.', array['predictive-sales'])
on conflict do nothing;