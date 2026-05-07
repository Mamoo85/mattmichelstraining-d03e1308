-- Ensure unique constraints exist for start-radar-trial native upserts
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='missed_call_clients_email_key') THEN
    -- Drop dup rows first if any (keep newest)
    DELETE FROM missed_call_clients a USING missed_call_clients b WHERE a.ctid<b.ctid AND a.email=b.email;
    ALTER TABLE missed_call_clients ADD CONSTRAINT missed_call_clients_email_key UNIQUE (email);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='field_crm_clients_email_key') THEN
    DELETE FROM field_crm_clients a USING field_crm_clients b WHERE a.ctid<b.ctid AND a.email=b.email;
    ALTER TABLE field_crm_clients ADD CONSTRAINT field_crm_clients_email_key UNIQUE (email);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='industry_pulse_clients_email_key') THEN
    DELETE FROM industry_pulse_clients a USING industry_pulse_clients b WHERE a.ctid<b.ctid AND a.email=b.email;
    ALTER TABLE industry_pulse_clients ADD CONSTRAINT industry_pulse_clients_email_key UNIQUE (email);
  END IF;
END $$;