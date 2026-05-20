create table if not exists public.etsy_oauth_tokens (
  key text primary key default 'default',
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  shop_id text,
  scope text,
  updated_at timestamptz not null default now()
);
alter table public.etsy_oauth_tokens enable row level security;
drop policy if exists "service_role full" on public.etsy_oauth_tokens;
create policy "service_role full" on public.etsy_oauth_tokens for all to service_role using (true) with check (true);

create table if not exists public.etsy_oauth_pending (
  state text primary key,
  code_verifier text not null,
  redirect_back text,
  created_at timestamptz not null default now()
);
alter table public.etsy_oauth_pending enable row level security;
drop policy if exists "service_role full" on public.etsy_oauth_pending;
create policy "service_role full" on public.etsy_oauth_pending for all to service_role using (true) with check (true);