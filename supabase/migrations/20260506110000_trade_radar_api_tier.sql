-- Trade Radar API tier columns
alter table trade_radar_clients
  add column if not exists api_tier text,      -- null = no API, 'developer' = $49/mo
  add column if not exists api_key text unique; -- UUID token for API authentication

create index if not exists trade_radar_clients_api_key_idx
  on trade_radar_clients(api_key)
  where api_key is not null;
