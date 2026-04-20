

## Why cherry-pick shows "No matching candidates" despite 184 candidates in DB

**Root cause — silent column mismatch in `AdminAgencyOutreach.tsx`:**

The component selects `id, name, role, county, score, created_at` from `hire_alert_candidates`, but the actual columns are `trade` and `city` (plus `metro`). Postgres returns `role: undefined` and `county: undefined` for all 184 rows. Then `matchingCandidatesFor()` runs a regex against `(c.role || "").toLowerCase()` — always empty string — so EVERY candidate is filtered out. Result: the cherry-pick panel shows "No matching candidates in last 7 days. Run scanner first." which is a lie. The DB has 13 healthcare + 152 industrial candidates ready right now.

The cherry-pick UI itself, the `agency-outreach-draft` Opus function, and the draft pipeline are all wired correctly. Only the data fetch + matcher is wrong.

---

## Fix (small, focused, 1 file + verification)

### A. Repoint the data layer to the real columns
**`src/components/dwa-admin/AdminAgencyOutreach.tsx`**
1. Change select to: `id, name, full_name, trade, city, metro, score, current_title, qualifications_summary, created_at`
2. Filter out company-name rows + do_not_contact rows: add `.eq("is_company_name", false).eq("do_not_contact", false)`
3. Rewrite `matchingCandidatesFor()` to use the real `trade` enum (boiler/hvac/electrical/plumbing/nursing/home_health/other_trade) instead of regex on `role`:
   - `healthcare` → `trade in ('nursing','home_health')` OR title regex match (RN/CNA/LPN/etc.)
   - `industrial` → `trade in ('boiler','hvac','electrical','plumbing','other_trade')` OR title regex
4. Update the cherry-pick row display to show `c.full_name || c.name`, `c.current_title || c.trade`, `c.city || c.metro`
5. Pass `licensed_role` = `current_title || trade` and `county` = `city || metro` into the draft payload (so the Opus prompt actually has something specific to lead with)

### B. Verify end-to-end after the fix
1. Open `/dwa-admin` → "🎯 Agency Outreach" tab
2. Confirm the badge says ~"184 candidates available for matching" (was 0 before)
3. Click **Cherry-Pick** on Maxim Healthcare Staffing → confirm the picker now shows the 13 healthcare candidates with tier badges
4. Pick the highest-scoring one → click **Draft with Opus**
5. Confirm draft returns ~110-140 words, leads with the picked candidate's role + city, no banned terms (LARA/MIOSHA/scraping/AI)
6. Repeat on Aerotek (industrial) — should now see 152 industrial candidates instead of "0"
7. Check `ai_action_queue` for the audit row written by the edge function

### C. What I'm NOT changing
- `agency-outreach-draft` edge function — already works
- `_shared/opus.ts` — already works
- `_shared/sanitize-candidate.ts` scrubbing — already works
- Cherry-pick UI/state/picker — already works
- The DB schema — no migration needed

### Risk
Low. Single component change, no schema, no edge-function redeploy, no migration. Worst case: the regex on `current_title` is too narrow and we fall back to the `trade` enum match (which will still surface all 13 healthcare and 152 industrial candidates).

### What you'll see in preview after the fix
The "No matching candidates" empty state from your screenshot will become a list of real candidates with names, titles, cities, and tier badges. Cherry-pick the strongest one → Opus drafts an email leading with that specific person → copy → paste in your inbox → send.

