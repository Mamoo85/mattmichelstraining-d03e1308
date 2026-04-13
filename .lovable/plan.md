

# Full QA Audit — Top 4 Revenue Engines

---

## 1. Contractor Leads (PPL)
**Readiness Score: 65% Ready**

### Critical Blockers (Red)

1. **Homeowner leads SILENTLY FAIL when not logged in.** RLS on `contractor_leads` has NO anon INSERT policy. The only INSERT policy is `service_role`. GetQuote.tsx uses the anon Supabase client. An unauthenticated homeowner (100% of real users) submitting the form gets a silent insert failure. Your test leads only worked because you were logged in as admin. **This means zero real leads will ever save.**

2. **Duplicate contractor_clients rows.** There are 12 rows total — 5 linked to lead sites + 5 duplicates + 1 audit test + 1 M2 legacy. Both sets have Matt's personal phone. When a real contractor onboards, they may get double-notified or the wrong record may be referenced.

3. **One test lead has `site_id: null` (bb9faa11).** The cron skips any lead where `site_id IS NULL` (line 41: `.not("site_id", "is", null)`). That lead was never notified and is stuck in `status: new` permanently.

### Minor Polish (Yellow)

- SMS copy has been upgraded with contact preference branching and DWA Lead Engine sign-off — looks correct
- Email template is premium dark brand — correct
- BCC goes to `matt@detroitwebagent.com` — correct
- `contractor-lead-notify` fires immediately via `supabase.functions.invoke()` after insert AND via 15-min cron — belt + suspenders, correct

### Missing Code

- No `claim-lead` page exists at `/claim-lead` — the PPL FOMO teaser SMS links to this URL (line 147) but there's no matching route in App.tsx

### Next Action
"Add anon INSERT policy on contractor_leads, clean up duplicate contractor_clients rows, verify /claim-lead route exists."

---

## 2. TechAlert (Hiring Monitor)
**Readiness Score: 70% Ready**

### Critical Blockers (Red)

1. **`trial_status` column does not exist.** Line 615 queries `.or("active.eq.true,trial_status.eq.active")`. The `hire_alert_clients` table has NO `trial_status` column. Supabase PostgREST will return a 400 error, which means **the scanner returns zero clients and sends zero alerts every single day.** This is the primary revenue engine for TechAlert and it is completely broken.

2. **Zero candidates in DB.** `hire_alert_candidates` has 0 rows. Even if the scanner ran, no historical data exists. This is expected if the scanner has never successfully completed a run (see blocker #1).

### Minor Polish (Yellow)

- FROM email now correctly uses `matt@detroitwebagent.com` — fixed
- BCC goes to `matthewmichels4@gmail.com` on client alerts (line 508) — consider changing to `matt@detroitwebagent.com` for consistency
- D.J. Conley TechAlert client still has `owner_email: matt@mattmichelstraining.com` — should be a real client email when they actually subscribe
- Scoring, dedup, role matching, zip filtering — all logic looks sound IF the scanner can actually run

### Missing Code

- `target_zip_codes` column referenced in code (line 747: `client.target_zip_codes`) but not in the table schema — silently defaults to empty array via `|| []`, so it's non-blocking but the feature is dead

### Next Action
"Fix hire-alert-scanner line 615: remove trial_status from the OR clause (just use `.eq('active', true)`). Add `target_zip_codes text[]` column if you want zip filtering to work."

---

## 3. Dead Lead Reactivation
**Readiness Score: 60% Ready**

### Critical Blockers (Red)

1. **`dead_lead_drip` queries columns that don't exist.** The code writes to `drip1_sent_at`, `drip2_sent_at`, `drip3_sent_at` (line 71, 116, 161) but the actual DB columns are `drip1_sent`, `drip2_sent`, `drip3_sent` (boolean, not timestamps). The `.lte("drip1_sent_at", twoDaysAgo)` filter on line 83 will fail — PostgREST returns 400 for unknown columns. **All drip2 and drip3 messages will never send.**

2. **`dead_lead_drip` queries `trade` column on `dead_lead_campaigns`.** Lines 35, 81, 126 select `dead_lead_campaigns(id, trade, status, ...)` but `dead_lead_campaigns` has NO `trade` column. The actual columns are: `id, contractor_id, name, status, total_contacts, replied_count, positive_count, pause_reason, paused_at, completed_at, campaign_copy_variants, created_at, updated_at`. This means the nested select fails and `campaign` is null for every contact. **Every drip message is skipped because `campaign?.status !== "active"` evaluates to `undefined !== "active"` = skip.**

3. **`dead_lead_contacts` has no `contractor_notified_at` column** — `handle-dead-lead-reply` line 238 tries to update this column on POSITIVE replies. This would cause the positive reply handler to fail, meaning contractors never get notified of revived leads.

4. **Zero campaigns, zero contacts in production.** `dead_lead_campaigns` and `dead_lead_contacts` are both empty. No data to drip on.

### Minor Polish (Yellow)

- `handle-dead-lead-reply` charge logic is correct (`res.ok` check exists at line 44)
- A/B campaign resume flow logic looks sound
- `email_reply_drafts` table now exists — ghost delay infrastructure is in place
- SMS copy is white-labeled correctly (contractor business name, not DWA)

### Missing Code

- `dead_lead_contacts` needs timestamp columns (`drip1_sent_at`, `drip2_sent_at`, `drip3_sent_at`) OR the code needs to be rewritten to use the boolean columns (`drip1_sent`, `drip2_sent`, `drip3_sent`)
- `dead_lead_campaigns` needs a `trade` column
- `dead_lead_contacts` needs a `contractor_notified_at` column
- `is_free_trial` column on `dead_lead_campaigns` — referenced in handle-dead-lead-reply but not in the schema

### Next Action
"Create migration to add `trade text`, `is_free_trial boolean DEFAULT false` to `dead_lead_campaigns`; add `drip1_sent_at timestamptz`, `drip2_sent_at timestamptz`, `drip3_sent_at timestamptz`, `contractor_notified_at timestamptz` to `dead_lead_contacts`. Then fix the dead-lead-drip select queries to match the actual schema."

---

## 4. FieldDesk (Field Service CRM)
**Readiness Score: 85% Ready**

### Critical Blockers (Red)

- **None found.** Checkout flow → Stripe webhook → `field_crm_clients` upsert → `auto-onboard` welcome email is wired end-to-end. RLS policies include service_role + admin access. Schema matches code expectations.

### Minor Polish (Yellow)

- 4 clients exist (3 pending, 1 active) — likely test records
- Admin panel (`AdminFieldCRMClients.tsx`) card click still opens tracking snippet modal, not client detail view
- No client-facing dashboard exists — clients receive emails/SMS only, no self-serve portal
- Welcome email from `auto-onboard` uses `matt@detroitwebagent.com` — correct

### Missing Code

- No client portal at `/my-fielddesk` or similar
- No visitor enrichment panel (planned in previous session, `enrich-visitor` edge function was created)

### Next Action
"Add clickable client detail panel in AdminFieldCRMClients. Consider building client portal for self-serve job management."

---

## Cross-Cutting Summary

| Issue | Severity | Impact |
|-------|----------|--------|
| `contractor_leads` missing anon INSERT RLS | **RED** | Zero real leads save |
| `hire-alert-scanner` queries non-existent `trial_status` | **RED** | Scanner returns 0 clients, sends 0 alerts |
| `dead-lead-drip` queries non-existent columns (`trade`, `drip*_sent_at`) | **RED** | All drip messages silently skip |
| `dead_lead_contacts` missing `contractor_notified_at` | **RED** | POSITIVE reply handler crashes |
| Duplicate `contractor_clients` rows | **YELLOW** | Confusion, double-notify risk |
| `/claim-lead` route missing | **YELLOW** | PPL claim link goes to 404 |
| `target_zip_codes` column missing on `hire_alert_clients` | **YELLOW** | Zip filtering silently disabled |

## Priority Fix Order

1. **RLS fix**: Add anon INSERT policy on `contractor_leads` so GetQuote actually works
2. **hire-alert-scanner fix**: Remove `trial_status` from query (line 615), just use `active.eq.true`
3. **Dead lead schema migration**: Add missing columns to `dead_lead_campaigns` and `dead_lead_contacts`
4. **Dead lead drip code fix**: Update select queries and update statements to match actual schema
5. **Clean up duplicate contractor_clients**
6. **Add `/claim-lead` route** or redirect to a working checkout page

## Files to Change

| File | Change |
|------|--------|
| New migration | Add anon INSERT on `contractor_leads`; add `trade`, `is_free_trial` to `dead_lead_campaigns`; add `drip*_sent_at`, `contractor_notified_at` to `dead_lead_contacts`; add `target_zip_codes` to `hire_alert_clients` |
| `supabase/functions/hire-alert-scanner/index.ts` | Line 615: change `.or("active.eq.true,trial_status.eq.active")` to `.eq("active", true)` |
| `supabase/functions/dead-lead-drip/index.ts` | Fix all 3 select queries to remove `trade` from campaign select; use correct column names for drip timestamps |
| `supabase/functions/handle-dead-lead-reply/index.ts` | Verify `contractor_notified_at` and `is_free_trial` column existence after migration |
| New route or redirect for `/claim-lead` | PPL FOMO flow needs a landing page |
| Data cleanup migration | Delete duplicate `contractor_clients` rows, keep only the 5 linked to `contractor_lead_sites` |

