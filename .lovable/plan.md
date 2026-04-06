

# Fix the Prospecting Pipeline

## The Problem
Neo (your cold outreach engine) and the Prospector (your lead finder) reference `prospect_businesses` and `prospect_outreach` tables that **do not exist in the database**. The migration file exists but was never applied. This means zero leads are being found and zero cold emails are being sent — the entire acquisition pipeline is offline.

Additionally, `prospect_businesses` is missing an `email` column, which Neo's code explicitly references (`prospect.email`). Without it, no emails can be sent even after the table exists.

## What Will Be Built

### Step 1: Database Migration
Create and apply a migration that builds:

- **`prospect_businesses`** — the lead database for Neo and Prospector
  - All existing columns from the migration file (business_name, address, city, state, phone, website, industry, google_place_id, review_count, rating, tier, has_website, outreach_status, notes, source)
  - **Add `email` column** (text, nullable) — this is the critical missing piece Neo needs
  - RLS enabled, service_role policy
  - Indexes on tier, outreach_status, industry, created_at

- **`prospect_outreach`** — tracks every email Neo sends
  - prospect_id (FK to prospect_businesses), email, business_name, industry, outreach_type, subject, status, sent_at, replied_at
  - RLS enabled, service_role policy
  - Index on sent_at for daily cap counting

### Step 2: Fix Neo Outreach Edge Function
- The function currently queries `prospect_businesses` correctly but the `email` field doesn't exist in the original schema — confirm the new migration adds it
- No code changes needed to `neo-outreach/index.ts` if the email column is added to the table

### Step 3: Verify Prospector Edge Function
- `prospect-local-businesses/index.ts` (764 lines) inserts into `prospect_businesses` — verify it populates the email field when available from Google Maps data
- If the prospector doesn't extract emails, add email extraction from the business website (via Firecrawl) during the scoring pass

## Technical Details

**Migration SQL** will use `CREATE TABLE IF NOT EXISTS` to be safe, with:
- `google_place_id TEXT UNIQUE` to prevent duplicate prospect entries
- Partial index on `outreach_status = 'new'` for Neo's hot query path
- The email column as nullable since not all prospects will have emails discoverable

**Files modified:**
- 1 new migration file
- Possibly `supabase/functions/prospect-local-businesses/index.ts` if email extraction is missing

**No frontend changes needed** — this is all backend pipeline infrastructure.

