-- Add owner_name to hire_alert_clients
-- Trial-convert and phantom-alert functions write/read this column.
-- Without it, conversion SMS/emails say "there" instead of the owner's name.
ALTER TABLE hire_alert_clients
  ADD COLUMN IF NOT EXISTS owner_name text;
