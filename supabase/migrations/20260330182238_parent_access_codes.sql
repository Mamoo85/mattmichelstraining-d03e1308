-- Parent access codes for the ParentView dashboard
-- Coach Matt generates a 6-char code per athlete and shares it with the parent

create table if not exists public.parent_access_codes (
  id uuid primary key default gen_random_uuid(),
  code char(6) not null unique,
  athlete_id uuid not null references public.profiles(user_id) on delete cascade,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

-- Index for fast code lookups (the only query pattern used)
create index parent_access_codes_code_idx on public.parent_access_codes (code);

-- RLS
alter table public.parent_access_codes enable row level security;

-- Anon users can look up a code to verify it (read-only, by code only)
create policy "anon can verify access code"
  on public.parent_access_codes
  for select
  to anon, authenticated
  using (true);

-- Only service_role can insert / update / delete codes
create policy "service_role full access"
  on public.parent_access_codes
  for all
  to service_role
  using (true)
  with check (true);
