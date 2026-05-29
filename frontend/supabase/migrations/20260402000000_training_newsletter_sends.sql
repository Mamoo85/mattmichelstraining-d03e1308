-- Training newsletter sends table
-- Tracks all monthly training newsletters generated + sent via both AI providers

create table if not exists training_newsletter_sends (
  id uuid primary key default gen_random_uuid(),
  subject text not null,
  content_html text,
  preview_text text,
  topic text,
  provider text not null default 'anthropic', -- 'anthropic' or 'lovable'
  status text not null default 'draft',        -- 'draft', 'sent', 'skipped'
  recipient_count integer default 0,
  scheduled_for timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

alter table training_newsletter_sends enable row level security;

create policy "service_role_all_training_newsletter_sends"
  on training_newsletter_sends for all to service_role
  using (true) with check (true);

create index if not exists training_newsletter_sends_created_idx
  on training_newsletter_sends(created_at desc);

create index if not exists training_newsletter_sends_status_idx
  on training_newsletter_sends(status);
