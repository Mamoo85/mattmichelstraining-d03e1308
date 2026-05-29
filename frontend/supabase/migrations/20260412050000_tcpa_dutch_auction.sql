-- TCPA compliance field for dead lead contacts
-- last_contact_date: when the homeowner LAST contacted the contractor
-- (determines the 18-month EBR expiry window — if null, created_at is used as proxy)
ALTER TABLE dead_lead_contacts
  ADD COLUMN IF NOT EXISTS last_contact_date date;

-- Dutch auction pricing tiers for aged PPL leads
-- 0 = fresh (< 48h), 1 = first markdown ($35, 48-72h),
-- 2 = second markdown ($20, 72-96h), 3 = final clearance ($10, 96h+)
ALTER TABLE contractor_leads
  ADD COLUMN IF NOT EXISTS aged_tier smallint NOT NULL DEFAULT 0;
