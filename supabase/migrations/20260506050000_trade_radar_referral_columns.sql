-- Referral program columns for trade_radar_clients

alter table trade_radar_clients
  add column if not exists referral_code text unique,
  add column if not exists referred_by_code text,
  add column if not exists referral_credits_days integer not null default 0;

create index if not exists trade_radar_clients_referral_code_idx on trade_radar_clients(referral_code);
create index if not exists trade_radar_clients_referred_by_code_idx on trade_radar_clients(referred_by_code);

comment on column trade_radar_clients.referral_code        is 'Unique referral code for this client to share';
comment on column trade_radar_clients.referred_by_code     is 'Referral code used when this client signed up';
comment on column trade_radar_clients.referral_credits_days is 'Free days earned from successful referrals (30 per conversion)';
