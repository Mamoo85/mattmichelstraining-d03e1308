-- TechAlert SMS-only tier support
alter table hire_alert_clients
  add column if not exists tier text not null default 'full'
    check (tier in ('full', 'sms_only'));

create index if not exists hire_REDACTED on hire_alert_clients(tier);
