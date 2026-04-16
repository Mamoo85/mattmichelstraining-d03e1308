

## Plan

### Part 1 — Kill the duplicate-key spam (root cause + cleanup)

**Root cause:** `hire_alert_clients.owner_email` has a UNIQUE constraint, but `stripe-webhook` line 782 uses `.insert()`. Every repeat checkout by the same email throws `duplicate key value violates unique constraint "hire_alert_clients_owner_email_key"` → triggers the failure email at line 903.

**Fixes:**
1. **`supabase/functions/stripe-webhook/index.ts` (~line 782):** Change `.insert({...})` to `.upsert({...}, { onConflict: "owner_email" })`. Repeat purchases now update `target_roles`, plan, stripe IDs, and re-activate instead of failing. (Same fix should be applied to other webhooks with unique-email tables — but scoped to TechAlert only for this pass to keep the change tight.)
2. **DB cleanup migration:** Delete the 7 broken/duplicate test rows (including the two where `owner_email` got populated with the person's NAME like "Matthew Michels" — those are corrupt) and consolidate into ONE canonical test client:
   - Email: `matt@mattmichelstraining.com`
   - Company: `M2 Test Co`
   - `target_roles`: ALL 14 roles (every trade + healthcare profession the scanner supports) so any candidate matches
   - `plan: 'standalone'`, `active: true`

### Part 2 — Naming decision

Plan called it "Detroit Talent Signal" / "Michigan Pre-Market Talent Feed." Both are fine but "Detroit Talent Signal" is already wired into `TalentIntelligence.tsx`. Two questions before I touch naming:

I'll ask you below — no rename happens without your pick.

### Part 3 — Finish the agency pivot (Lovable's plan, audited)

What's already done that the plan said was missing (verified just now):
- ✅ `config.toml` — all 5 agency function entries already exist (lines 1576–1591), plus a 6th (`agency-proof-drop-followup`). **GAP 1 is closed.**

What's actually still missing:
- ❌ **GAP 2 — Stripe webhook handler for `agency_interview_charge`.** Confirmed: zero matches in `stripe-webhook/index.ts`. Charges fire from `agency-fast-track-interview` but `charged_at`/`stripe_charge_id` are written inline in that function already (line 65-66 of fast-track), so the webhook handler is a **belt-and-suspenders sync** for off-session charges that succeed asynchronously (e.g. 3DS retries). Still worth adding — listen on `payment_intent.succeeded` with `metadata.type === "agency_interview_charge"` and update the assignment row.
- ❌ **GAP 3 — Language scrub.** The plan lists 7 client-facing strings. I'll fix exactly those 7 (Stripe product description, HireAlert.tsx ×2, HireAlertTrial.tsx, HealthcareHireAlert.tsx ×2, hire-alert-scanner email badge). Internal scanner code/comments stay untouched — agencies never see them and renaming them risks breaking the actual scrapers.
- ❌ **Improvement #7 — Delivery jitter** in `agency-distribute-candidates` (0–2hr randomized delay so the 7am pattern isn't detectable).
- ❌ **Improvement #10 — SMS to Matt** from `agency-monthly-flip` so flip-ready alerts don't get buried in email.

### Part 4 — Skipping (with reasoning)

- **Improvement #2 ROI calculator, #3 territory scarcity copy, #4 48-hr Proof Drop follow-up, #5 case study block** — these are marketing copy iterations, not blockers. Better done after the first 1–2 agency conversations so the copy reflects real objections heard. Flagging for a later sprint.
- **Improvement #8 passive-candidate mixing** — needs a "passive pool" data source we don't have yet (would require new Sonar prompts + storage). Punt to a v2 sprint after first agency goes live.
- **Improvement #9 rate-limit `/agency-portal`** — defensive hardening. Add when agency #2 signs (premature optimization for zero customers).

### Build order (~45 min total)

1. Migration: cleanup test rows + insert canonical test client
2. `stripe-webhook` insert→upsert fix
3. `stripe-webhook` add `agency_interview_charge` handler on `payment_intent.succeeded`
4. 7-line language scrub across 5 files
5. Jitter in `agency-distribute-candidates`
6. SMS in `agency-monthly-flip`

### Verification
- Re-trigger a TechAlert checkout for `matt@mattmichelstraining.com` → no failure email, row updates in place
- DB query: exactly ONE `hire_alert_clients` row for any of Matt's emails
- Grep 5 client-facing files: zero MIOSHA / LARA / Apollo / "NPI Verified" / LinkedIn matches
- `agency-fast-track-interview` test charge → assignment row gets `charged_at` from webhook

