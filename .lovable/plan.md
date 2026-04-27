# Why it's broken (3 separate issues)

I queried the database and read the enrichment edge function. Here are the actual root causes — none of them are "the search is broken in general."

## Issue 1 — Why healthcare shows "No matching candidates in last 7 days"

**Real numbers from `hire_alert_candidates` table right now:**

| Trade | Total | Last 7d |
|---|---:|---:|
| boiler | 72 | **0** |
| other_trade | 40 | 40 |
| hvac | 30 | 4 |
| electrical | 28 | 1 |
| plumbing | 25 | 13 |
| **nursing** | **10** | **0** |
| **home_health** | **2** | **0** |

We have only **12 healthcare candidates ever**, and the last one was added **April 19** — 8 days ago. The Cherry-Pick widget filters to last 7 days, so it correctly shows zero. The healthcare scrapers stopped producing.

**Likely cause:** the healthcare source modules (Indeed/ZipRecruiter RN/CNA/LPN scrapers in the TechAlert pipeline) are either erroring silently or the cron stopped firing for the healthcare verticals. Industrial scrapers are healthy (40+ in last 7d).

## Issue 2 — Why "Enrich Contact" returns "No contact found" for every agency

I read `supabase/functions/agency-contact-enrich/index.ts` and compared it against the 4 other working Apollo functions in the codebase. Two real bugs:

**Bug A — wrong Apollo header casing.** Line 55 sends `"x-api-key"` (lowercase). Every other Apollo function in the repo (`apollo-test-enrich`, `enrich-lo-prospect`, `apollo-backfill-decision-makers`) uses `"X-Api-Key"` (capitalized). Apollo's gateway is case-sensitive on some routes and silently 401s.

**Bug B — wrong endpoint for this use case.** It uses `mixed_people/search`, which on Apollo's standard plan returns people **without unlocked emails** (just names). Code then checks `if (apollo?.email)` and bails. The `apollo-test-enrich` function uses `people/match` + `organizations/enrich` which DO return unlocked emails on the same plan.

**Bug C — Hunter/Snov fallbacks may not be wired.** `HUNTER_API_KEY`, `SNOV_CLIENT_ID`, `SNOV_CLIENT_SECRET` ARE set in your secrets (verified). So fallbacks should fire — but if Apollo silently returns a name with no email, the function never falls through to Hunter (the `if (!result.contact_email && domain)` gate works, but the trace is never surfaced to the UI so we can't see *why* it failed).

## Issue 3 — Nursys license number capture

You need to store an RN license number per healthcare candidate so you can keep the Nursys.com e-Notify monitoring active. Currently `hire_alert_candidates` has no `license_number` / `license_state` / `nursys_enrolled` columns. `NURSYS_USERNAME` and `NURSYS_PASSWORD` ARE in your secrets — the integration just isn't wired.

---

# The fix

## Part A — Restore healthcare candidate flow
1. Add an admin "Healthcare Source Health" panel to the Cherry-Pick page showing: last successful run per healthcare source, last error, candidates added in 24h/7d.
2. Add a one-click **"Re-run healthcare scrapers now"** button that invokes the existing healthcare source edge functions (whatever is named `*-nursing-*` / `*-rn-*` / `*-cna-*`) and surfaces errors.
3. Audit which healthcare cron jobs exist; if they're missing or disabled, re-add them with daily 6am ET schedule.

## Part B — Fix Apollo enrichment (the real fix)
1. **Rewrite `agency-contact-enrich/index.ts` waterfall** to mirror the proven `apollo-test-enrich` pattern:
   - Stage 1: Apollo `organizations/enrich` (resolve org_id from domain) → `people/match` with `reveal_personal_emails: true` (unlocks the email).
   - Stage 2: Apollo `mixed_people/search` filtered by org_id + titles (current code, but with org_id, not just domain).
   - Stage 3: Hunter `domain-search` (already correct).
   - Stage 4: Snov `domain-search` (already correct).
   - Stage 5: Pattern guess + SMTP verify via Hunter `email-verifier`.
2. **Fix header casing**: `"X-Api-Key"` everywhere.
3. **Return the trace in the UI**: when no contact is found, show a small expandable diagnostic on the agency card: *"Apollo: hit (no email unlocked) · Hunter: miss · Snov: miss · Pattern: guessed → bounced"*. So you can see WHY it failed, not just "no contact found."
4. **Add 4 more known-good Metro Detroit healthcare staffing agencies** to the seed list so you have more shots on goal: Interim HealthCare of Detroit, Comfort Keepers Metro Detroit, ATC Healthcare Services, Soliant Health.

## Part C — Nursys license capture
1. **Migration**: add `license_number TEXT`, `license_state TEXT DEFAULT 'MI'`, `nursys_enrolled BOOLEAN DEFAULT false`, `nursys_enrolled_at TIMESTAMPTZ` columns to `hire_alert_candidates`.
2. **Add a license editor** on each healthcare candidate row in the Cherry-Pick view: text input + state dropdown + "Enroll in Nursys" button.
3. **Build `nursys-enroll` edge function**: takes `candidate_id`, calls Nursys e-Notify API with stored `NURSYS_USERNAME`/`NURSYS_PASSWORD`, marks `nursys_enrolled = true` on success.
4. **Build `nursys-license-lookup` edge function**: when you have a candidate name + state but no license number, attempts a Nursys QuickConfirm lookup to auto-populate the license number. (Falls back to manual entry.)
5. **Add a daily `nursys-status-sync` cron** that pulls Nursys e-Notify status changes (license expiry, discipline) and writes alerts to `hire_alert_candidates.qualifications_summary`.

## Part D — Diagnostic info box
Add an "Enrichment Health" info box at the top of `AdminAgencyOutreach.tsx` showing per-provider status:
- ✅/❌ Apollo key present + last successful call timestamp + monthly credit usage
- ✅/❌ Hunter key present + last successful call + remaining credits
- ✅/❌ Snov key present + last successful call + remaining credits
- ✅/❌ Nursys credentials present + last sync

---

# Files I'll touch

**New:**
- `supabase/functions/nursys-enroll/index.ts`
- `supabase/functions/nursys-license-lookup/index.ts`
- `supabase/functions/nursys-status-sync/index.ts`
- `supabase/functions/healthcare-sources-rerun/index.ts`
- `supabase/migrations/<ts>_nursys_license_columns.sql`
- `supabase/migrations/<ts>_healthcare_cron_restore.sql`
- `src/components/dwa-admin/EnrichmentHealthPanel.tsx`
- `src/components/dwa-admin/HealthcareSourceHealthPanel.tsx`
- `src/components/dwa-admin/CandidateLicenseEditor.tsx`

**Edited:**
- `supabase/functions/agency-contact-enrich/index.ts` (rewrite waterfall + return trace)
- `src/components/dwa-admin/AdminAgencyOutreach.tsx` (4 new healthcare agencies, render trace, mount new panels, license editor on candidate rows)
- `supabase/config.toml` (3 new functions need `verify_jwt = false` for cron)

---

# What you'll see after I ship

1. The 5 agency cards will show real names + verified emails (Apollo unlocked) within seconds of clicking "Enrich Contact" — and if any provider can't find one, you'll see exactly which stage failed and why.
2. Healthcare section will repopulate within ~24h of the cron firing (or instantly if you click "Re-run healthcare scrapers now").
3. Each healthcare candidate row gets a license-number field + "Enroll in Nursys" button — Nursys monitoring stays active forever.
4. A persistent diagnostic panel tells you at a glance whether Apollo / Hunter / Snov / Nursys are healthy — no more guessing.

Approve and I'll build it.
