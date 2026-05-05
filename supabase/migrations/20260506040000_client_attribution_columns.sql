-- Lead-to-close attribution tracking for the 3 core DWA subscription tables

alter table hire_alert_clients
  add column if not exists acquisition_source text,
  add column if not exists closed_at timestamptz,
  add column if not exists reply_at timestamptz,
  add column if not exists outreach_sent_at timestamptz;

alter table trade_radar_clients
  add column if not exists acquisition_source text,
  add column if not exists closed_at timestamptz,
  add column if not exists reply_at timestamptz,
  add column if not exists outreach_sent_at timestamptz;

alter table mortgage_radar_clients
  add column if not exists acquisition_source text,
  add column if not exists closed_at timestamptz,
  add column if not exists reply_at timestamptz,
  add column if not exists outreach_sent_at timestamptz;

-- acquisition_source values: 'cold_email', 'sms', 'referral', 'organic', 'linkedin', 'paid_ad', 'direct'
comment on column hire_alert_clients.acquisition_source   is 'How this client was acquired';
comment on column trade_radar_clients.acquisition_source  is 'How this client was acquired';
comment on column mortgage_radar_clients.acquisition_source is 'How this client was acquired';
