-- Add a non-expression UNIQUE constraint on techalert_prospect_targets(company_name, role)
-- so that Supabase JS upsert with onConflict: "company_name,role" works correctly.
--
-- Background: migration 20260417055518 created an expression-based unique index:
--   CREATE UNIQUE INDEX uq_techalert_prospect_targets_company_role
--   ON techalert_prospect_targets (lower(company_name), lower(coalesce(role,'')));
--
-- PostgREST / Supabase JS upsert cannot target expression-based indexes via column names.
-- This constraint gives it a non-expression target while the expression index remains for
-- case-insensitive lookups.

ALTER TABLE public.techalert_prospect_targets
  ADD CONSTRAINT uq_prospect_company_role
  UNIQUE (company_name, role);
