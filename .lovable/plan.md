## Context — what already exists

Audit confirmed most backend is already shipped:

- `contractor_outreach_prospects` — has `email_verified`, `consent_for_sms`, `consent_source`, `consent_timestamp`, `unsubscribed_at`, `enrichment_trace` (jsonb)
- `contractor_outreach_audit_log` — already accepts events: sent/opened/clicked/replied/unsubscribed/suppressed/consent_granted/consent_revoked/quiet_hours_blocked/daily_cap_blocked/bounce
- `contractor_outreach_suppression` — sources include unsubscribe_link/bounce/complaint/manual/sms_stop
- Edge functions exist: `contractor-outreach-scrape`, `-enrich`, `-email-blast`, `-sms-send`, `-unsubscribe`
- UI exists: `ContractorOutreachPanel`, `OutreachConsentDialog`, `OutreachAuditDrawer`, `OutreachSuppressionManager`
- Email waterfall (`_shared/email-waterfall.ts`) has 6-stage waterfall with PDL last, but only fires when `business_name + city` present — does NOT do name-only `mixed_people/search`

So the work is: **(a) small additive schema for email consent + quality score, (b) one enrichment-pipeline upgrade, (c) UI clarity panels (InfoBoxes), (d) trade/territory filters, (e) global audit log page.** No duplicate tables.

## Plan

### 1. Schema (one additive migration)

Add to `contractor_outreach_prospects`:
- `consent_for_email boolean not null default false`
- `consent_email_source text` / `consent_email_timestamp timestamptz`
- `quality_score smallint` (0–100, computed)
- `quality_breakdown jsonb` (email_validity / enrichment_confidence / territory_match sub-scores)
- `is_demo boolean not null default false`
- `territory_priority smallint default 3` (1=primary, 2=secondary, 3=opportunistic)

Add admin kill-switches table `outreach_global_settings` (single row):
- `cold_email_enabled`, `cold_sms_enabled`, `min_quality_score_to_send`, `hide_demo_leads_below_score`, `updated_by`, `updated_at`

Backfill `quality_score` via SQL from existing fields. Index on `(quality_score desc, unsubscribed_at)`.

### 2. Enrichment upgrade (PDL name-only fallback)

In `_shared/email-waterfall.ts`, add a Stage 6.5: when `business_name + city` returns null AND we have `owner_name`, call PDL `mixed_people/search` with name filter, take top match, then resolve email via existing PDL person enrich. Wire into `contractor-outreach-enrich` so healthcare records (RN, CNA, etc. — name without business) get enriched instead of returning null. Trace appended to `enrichment_trace` as before.

### 3. Quality score computation

Add `compute_prospect_quality_score(prospect_id)` Postgres function:
- email validity: 40 pts (verified=40, present-unverified=20, none=0)
- enrichment confidence: 30 pts (read top trace entry confidence × 30)
- territory match: 30 pts (primary=30, secondary=20, opportunistic=10)

Triggered on insert/update of email/enrichment_trace/territory_priority. Admin toggle auto-hides prospects with score < threshold flagged `is_demo`.

### 4. UI — ContractorOutreachPanel upgrades

- **InfoBox at top** (`<OutreachInfoBox />`): explains in plain English — "What is a verified lead?", "How we enrich emails (6-stage waterfall)", "What FB ID means", "Why some leads are locked", "How priority works", "How to unlock". Collapsible, default-open on first visit (localStorage).
- **Trade + territory filter row**: multi-select trade dropdown (HVAC, Plumbing, Electrical, Roofing, Boiler, Gutters, Siding, Healthcare/RN, Healthcare/CNA), city autocomplete, territory priority dropdown, min-quality slider, "hide demo leads" toggle.
- **Per-row badges**: quality score pill (green ≥75, amber 50-74, red <50), email-consent badge (green ✓ / amber Pending / red ✗), SMS-consent badge, verified-email checkmark.
- **Per-row actions**: Grant/revoke email consent, Grant/revoke SMS consent (writes to audit log automatically via existing `OutreachConsentDialog` — extend it to handle both channels).
- **Global toggles bar** (admin-only): Cold Email ON/OFF, Cold SMS ON/OFF, min-quality slider, hide-demo toggle. Writes to `outreach_global_settings`.

### 5. Send-path enforcement

Update `contractor-outreach-email-blast` and `contractor-outreach-sms-send`:
- Read `outreach_global_settings`; if channel disabled → log `quiet_hours_blocked` (reason: "global kill switch") and return.
- Require `consent_for_email=true` for email (or `source='cold_b2b_legitimate_interest'` with valid CAN-SPAM footer — current behavior preserved for cold but logged distinctly as `cold_outreach`).
- Require `consent_for_sms=true` for SMS — block all sends without it (no cold SMS).
- Skip prospects below `min_quality_score_to_send`.
- Every send/skip writes to `contractor_outreach_audit_log` with `actor = auth.uid email or 'system'`.

### 6. Outreach Activity & Audit Log page

New route `/dwa-admin/outreach-audit` + sidebar entry. Lists `contractor_outreach_audit_log` with filters: channel, event type, prospect, actor, date range. Exports CSV. Click-through opens prospect drawer. Reuses existing `OutreachAuditDrawer` styling.

### 7. Unsubscribe click logging

`contractor-outreach-unsubscribe` already exists — verify it writes `event='unsubscribed'` with `ip_address`/`user_agent` to audit log. Add the writes if missing.

## Files

**New (5):**
- `supabase/migrations/<ts>_outreach_consent_quality.sql`
- `src/components/admin/OutreachInfoBox.tsx`
- `src/components/admin/OutreachGlobalSettings.tsx`
- `src/pages/admin/OutreachAuditLog.tsx` + sidebar wiring
- (maybe) `supabase/functions/_shared/quality-score.ts`

**Edited (~7):**
- `src/components/admin/ContractorOutreachPanel.tsx` (filters, badges, info box)
- `src/components/admin/OutreachConsentDialog.tsx` (add email channel)
- `supabase/functions/_shared/email-waterfall.ts` (PDL name-only stage)
- `supabase/functions/contractor-outreach-enrich/index.ts` (quality recompute)
- `supabase/functions/contractor-outreach-email-blast/index.ts` (kill-switch + consent + audit)
- `supabase/functions/contractor-outreach-sms-send/index.ts` (same)
- `supabase/functions/contractor-outreach-unsubscribe/index.ts` (verify audit write)

## Out of scope (explicitly skipped)

- New tables for audit/suppression/consent (reused existing)
- New enrichment vendor (just better use of PDL we already have)
- Statewide MI city expansion (still pending from earlier plan — call out, don't bundle)

## Approve to ship?
