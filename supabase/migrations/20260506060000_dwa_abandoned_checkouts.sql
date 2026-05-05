-- Extend cart_abandonments to support DWA product recovery

alter table cart_abandonments
  add column if not exists recovery_sent_at timestamptz,
  add column if not exists discount_code text,
  add column if not exists brand text not null default 'm2';

create index if not exists cart_abandonments_brand_recovery_idx
  on cart_abandonments(brand, recovery_sent_at)
  where recovery_sent_at is null;
