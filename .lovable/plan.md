

# Phases 1–4: Data Sanitization + Rich Cards + Deep Links + Action Buttons

## Constraint Understood
Only Phases 1–4. No feature development beyond these. Phases 5–10 saved for later.

## Current State
- **148 candidates** in DB, **7 are company names** ("Comfort Zone and", "SUPREME and", "Keitz and Appliance", "Marvin and Son", etc.)
- `isPersonName()` in the MIOSHA scraper already rejects LLC/Inc/Corp but **misses** patterns like "X and Y", company-like fragments ("Comfort Zone"), and ALL-CAPS short names
- The tease email (`techalert-tease-conley`) uses `c.name` and shows bare-minimum fields (name, license type, city, license #, source)
- The alert email (`hire-alert-scanner`) already has rich cards with qualifications, recommendations, and action buttons — but only for client alerts, NOT the tease
- MyTechAlert dashboard has **no** `highlight` query param support

---

## PHASE 1: Aggressive Data Sanitization

### A. Expand `COMPANY_SIGNALS` in both files
Add to the blocklist in `miosha-license-scraper/index.ts` AND `hire-alert-scanner/index.ts`:
- "and" (as a standalone word boundary match, not substring — use `\band\b`)
- "comfort", "zone", "supreme", "keitz", "marvin", "son" (as word-boundary)
- "&", "d/b/a" (already partially there)
- Any name ending with "and" (truncated company names from MIOSHA)

### B. Add `isPersonName()` guardrail to upsert path
In `miosha-license-scraper`, right before the upsert block (~line 1040), add:
```
if (!isPersonName(c.full_name)) {
  console.log(`[upsert] ⛔ Rejected company name: "${c.full_name}"`);
  continue;
}
```
This prevents company names from ever entering the DB going forward.

### C. One-time DB cleanup
Run a migration to quarantine existing company-name records:
```sql
UPDATE hire_alert_candidates 
SET status = 'quarantined'
WHERE full_name ~* '\y(and|comfort|supreme|keitz|marvin|son)\y'
  OR full_name ~* '(llc|inc|corp|heating|cooling|&)'
  OR full_name = upper(full_name) AND length(full_name) > 8;
```

### D. Add `is_company_name` boolean column
Flag for data integrity — quarantined records won't appear in any email query.

---

## PHASE 2: Premium Rich Candidate Cards (Tease + Alert emails)

### Rewrite `techalert-tease-conley/index.ts`
- Query `full_name` (not `name`), plus: `qualifications_summary`, `hiring_recommendation`, `score`, `license_expiry`, `current_employer`, `years_experience`, `phone`, `email`, `linkedin_url`
- Filter out `status = 'quarantined'` and add `isPersonName()` check
- Each revealed card renders:
  1. **Sanitized human name** — prominent header, title-cased
  2. **License Type & Number** — with expiry date and active/expiring badge
  3. **Availability Score Badge** — color-coded (🟢 High / 🟡 Possible / 🔵 Monitor)
  4. **AI Qualifications Summary** — green bordered block (reuse alert email style)
  5. **Current Employer** — if enriched
  6. **Years Experience** — if available
  7. **"Why This Candidate"** — score_reason as a signal blurb

### Upgrade `hire-alert-scanner` alert email
- Already has rich cards — just ensure `status != 'quarantined'` filter is added to the candidate query
- Already has action buttons — verified

---

## PHASE 3: Deep-Linked Workflows

### A. Add `highlight` param to `MyTechAlert.tsx`
- Read `highlight` from `useSearchParams`
- On data load, scroll to the candidate card matching that ID
- Auto-expand that candidate's detail panel
- Add a `useEffect` with `scrollIntoView({ behavior: 'smooth' })` on a ref attached to the highlighted card
- Visual highlight: pulsing teal border on the target card

### B. Generate deep links in emails
Both tease and alert emails: candidate name becomes a clickable link:
```
https://m2training.lovable.app/my-techalert?token={CLIENT_TOKEN}&highlight={CANDIDATE_ID}
```
For tease emails (no client token yet): link to checkout page `/hire-alert` instead.

---

## PHASE 4: In-Email Action Buttons

### Tease email (prospect — no account)
Each revealed card gets:
- **[ ⚡ Unlock All Candidates ]** → links to `/hire-alert` checkout
- **[ 📊 See Live Dashboard Demo ]** → links to `/my-techalert?token=DEMO` (existing demo mode)

### Alert email (paying client)
Already has action buttons (LinkedIn, Facebook, Email, Phone, License Verify). Add two more:
- **[ ⚡ Claim This Candidate ]** → deep link: `/my-techalert?token=X&auto=1&claim=CANDIDATE_ID`
- **[ ✍️ Draft Outreach ]** → deep link: `/my-techalert?token=X&highlight=CANDIDATE_ID&action=draft`

### Dashboard auto-actions
In `MyTechAlert.tsx`, read `auto`, `claim`, and `action` params:
- `auto=1&claim=ID` → auto-trigger claim API on mount
- `action=draft` → auto-open outreach draft modal for highlighted candidate

---

## Files Modified

| File | Changes |
|------|---------|
| `supabase/functions/miosha-license-scraper/index.ts` | Expand `COMPANY_SIGNALS`, add guardrail before upsert |
| `supabase/functions/hire-alert-scanner/index.ts` | Add quarantine filter to candidate queries, add Claim/Draft buttons to alert email |
| `supabase/functions/techalert-tease-conley/index.ts` | Complete rewrite — rich cards, deep links, action buttons, `full_name` usage |
| `src/pages/MyTechAlert.tsx` | Add `highlight`/`claim`/`action` query param handling, auto-scroll, auto-expand |
| Migration | Add `is_company_name` column, quarantine existing bad records |

## Testing Instructions
After deployment:
1. Invoke `techalert-tease-conley` via the admin "Send DJ Conley Tease" button (sends to matt@mattmichelstraining.com)
2. Verify: no company names, rich candidate cards with qualifications and scores, deep links in candidate names, action buttons visible
3. Optionally invoke `hire-alert-scanner` manually from admin to test enriched client alert emails

