-- White-label fields for Trade Radar agency reseller tier
alter table trade_radar_clients
  add column if not exists is_whitelabel boolean not null default false,
  add column if not exists whitelabel_brand text,        -- agency brand name
  add column if not exists whitelabel_logo_url text,     -- agency logo for digest
  add column if not exists whitelabel_from_email text,   -- agency reply-to address
  add column if not exists whitelabel_agency_id text;    -- links to agency_whitelabel_subscription

create index if not exists trade_radar_clients_whitelabel_idx
  on trade_radar_clients(is_whitelabel)
  where is_whitelabel = true;
