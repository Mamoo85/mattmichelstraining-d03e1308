-- LinkedIn D0 connection tracking for TechAlert prospects
alter table techalert_prospect_targets
  add column if not exists owner_linkedin_url text,
  add column if not exists li_connect_sent_at timestamptz;
